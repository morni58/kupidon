"""Telegram Stars payment handlers."""
import os
import sys
from aiogram import Router, F
from aiogram.types import PreCheckoutQuery, Message

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

router = Router()


@router.pre_checkout_query()
async def process_pre_checkout(pre_checkout: PreCheckoutQuery):
    """Must answer within 10 seconds, otherwise the payment fails."""
    await pre_checkout.answer(ok=True)


@router.message(F.successful_payment)
async def process_successful_payment(message: Message):
    """Apply the purchased product after Telegram confirms the Stars payment."""
    sp = message.successful_payment
    payload = sp.invoice_payload

    db = await _get_db()
    from sqlalchemy import select
    from app.models.payment import Payment, PaymentStatusEnum
    from app.models.user import User, TierEnum

    result = await db.execute(select(Payment).where(Payment.invoice_payload == payload))
    payment = result.scalar_one_or_none()

    if not payment:
        await db.close()
        await message.answer("⚠️ Платёж не найден. Обратись в поддержку.")
        return

    if payment.status == PaymentStatusEnum.paid:
        await db.close()
        await message.answer("✅ Уже оплачено.")
        return

    payment.status = PaymentStatusEnum.paid

    user_r = await db.execute(select(User).where(User.id == payment.user_id))
    user = user_r.scalar_one_or_none()
    if user:
        product = payment.product
        if product == "force_chat":
            user.force_chats_used = max(0, user.force_chats_used - 1)
        elif product == "boost":
            user.superlikes_left += 3
        elif product == "superlike":
            user.superlikes_left += 1
        elif product == "vip_signal":
            user.vip_signals_used = max(0, user.vip_signals_used - 1)
        elif product == "premium_month":
            user.tier = TierEnum.premium
            user.swipes_left = 200
            user.superlikes_left = 5
        elif product == "kupidon_month":
            user.tier = TierEnum.kupidon
            user.swipes_left = 500
            user.superlikes_left = 5
            user.is_oligarch_mode = True

    await db.commit()
    await db.close()
    await message.answer(f"✅ Оплата прошла! Продукт «{payment.product}» активирован 💘")


async def _get_db():
    from app.db.database import async_session_maker
    return async_session_maker()
