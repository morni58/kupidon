from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.core.deps import get_db, get_current_user
from app.models.user import User, TierEnum
from app.models.payment import Payment, PaymentStatusEnum
from app.schemas.payment import PaymentWebhook
from app.services.economy import get_config_value

router = APIRouter(prefix="/api/payments", tags=["payments"])

PRODUCTS = {
    "force_chat": "force_chat_stars",
    "boost": "boost_stars",
    "superlike": "superlike_stars",
    "vip_signal": "vip_signal_stars",
    "premium_month": None,   # subscription handled via bot
    "kupidon_month": None,
}


PRODUCT_META = {
    "force_chat": ("Force Chat", "Написать без взаимного лайка"),
    "boost": ("Буст 2 часа", "Поднять анкету в топ на 2 часа"),
    "superlike": ("Суперлайк", "Один суперлайк — всплывёшь первым"),
    "vip_signal": ("VIP сигнал", "Усиленный анонимный сигнал"),
    "premium_month": ("Premium на месяц", "200 свайпов/день, Rewind, врывы"),
    "kupidon_month": ("Kupidon VIP на месяц", "500 свайпов, Олигарх-режим"),
}

# Subscription prices in Stars (configurable via /economy)
SUB_STARS = {"premium_month": "199", "kupidon_month": "599"}


@router.post("/create_invoice")
async def create_invoice(
    product: str,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if product not in PRODUCTS:
        raise HTTPException(status_code=400, detail="Unknown product")

    stars_key = PRODUCTS.get(product)
    if stars_key:
        stars = int(await get_config_value(db, stars_key, "50"))
    else:
        stars = int(await get_config_value(db, f"{product}_stars", SUB_STARS.get(product, "199")))

    payload = f"{me.id}:{product}:{uuid.uuid4()}"

    payment = Payment(
        user_id=me.id,
        invoice_payload=payload,
        stars=stars,
        product=product,
        status=PaymentStatusEnum.pending,
    )
    db.add(payment)
    await db.commit()

    # Create a real Telegram Stars invoice link via Bot API (currency XTR).
    title, description = PRODUCT_META.get(product, (product, product))
    invoice_link = None
    try:
        import httpx
        from app.core.config import settings
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{settings.BOT_TOKEN}/createInvoiceLink",
                json={
                    "title": title,
                    "description": description,
                    "payload": payload,
                    "currency": "XTR",
                    "prices": [{"label": title, "amount": stars}],
                },
            )
            data = resp.json()
            if data.get("ok"):
                invoice_link = data["result"]
    except Exception:
        invoice_link = None

    return {
        "invoice_payload": payload,
        "stars": stars,
        "product": product,
        "invoice_link": invoice_link,  # frontend opens via WebApp.openInvoice
    }


@router.post("/webhook/successful_payment")
async def payment_webhook(
    body: PaymentWebhook,
    db: AsyncSession = Depends(get_db),
):
    """Called by the bot on successful_payment event."""
    result = await db.execute(
        select(Payment).where(Payment.invoice_payload == body.invoice_payload)
    )
    payment = result.scalar_one_or_none()

    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status == PaymentStatusEnum.paid:
        return {"ok": True, "idempotent": True}  # idempotent

    payment.status = PaymentStatusEnum.paid

    # Apply product effect
    user_r = await db.execute(select(User).where(User.id == payment.user_id))
    user = user_r.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    product = payment.product
    stars = payment.stars

    if product == "force_chat":
        # Free user gets one force chat session
        pass  # handled by paying the invoice before force_chat endpoint
    elif product == "boost":
        user.stars_balance = max(0, user.stars_balance - stars)
        # Boost: give extra superlikes & bump swipes
        user.superlikes_left += 3
    elif product == "superlike":
        user.superlikes_left += 1
    elif product == "vip_signal":
        user.vip_signals_used = max(0, user.vip_signals_used - 1)
    elif product == "premium_month":
        user.tier = TierEnum.premium
        user.swipes_left = 200
        user.superlikes_left = 5
        user.force_chats_used = 0
    elif product == "kupidon_month":
        user.tier = TierEnum.kupidon
        user.swipes_left = 500
        user.superlikes_left = 5
        user.force_chats_used = 0
        user.is_oligarch_mode = True

    await db.commit()
    return {"ok": True}
