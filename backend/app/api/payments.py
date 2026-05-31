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


@router.post("/create_invoice")
async def create_invoice(
    product: str,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if product not in PRODUCTS:
        raise HTTPException(status_code=400, detail="Unknown product")

    stars_key = PRODUCTS.get(product)
    stars = int(await get_config_value(db, stars_key, "50")) if stars_key else 0

    payload = f"{me.id}:{product}:{uuid.uuid4()}"

    # Create pending payment (idempotent by payload)
    payment = Payment(
        user_id=me.id,
        invoice_payload=payload,
        stars=stars,
        product=product,
        status=PaymentStatusEnum.pending,
    )
    db.add(payment)
    await db.commit()

    # In prod: call bot.send_invoice(chat_id=me.tg_id, ...)
    return {"invoice_payload": payload, "stars": stars, "product": product}


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
