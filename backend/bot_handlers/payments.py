"""Telegram Stars payment handlers."""
from aiogram import Router, F
from aiogram.types import PreCheckoutQuery, Message

from app.db.database import async_session_maker

router = Router()


@router.pre_checkout_query()
async def process_pre_checkout(pre_checkout: PreCheckoutQuery):
    await pre_checkout.answer(ok=True)


@router.message(F.successful_payment)
async def process_successful_payment(message: Message):
    from sqlalchemy import select
    from app.models.payment import Payment, PaymentStatusEnum
    from app.models.user import User, TierEnum

    payload = message.successful_payment.invoice_payload
    async with async_session_maker() as db:
        result = await db.execute(select(Payment).where(Payment.invoice_payload == payload))
        payment = result.scalar_one_or_none()
        if not payment:
            await message.answer("⚠️ Платёж не найден.")
            return
        if payment.status == PaymentStatusEnum.paid:
            await message.answer("✅ Уже оплачено.")
            return

        payment.status = PaymentStatusEnum.paid
        user_r = await db.execute(select(User).where(User.id == payment.user_id))
        user = user_r.scalar_one_or_none()
        if user:
            p = payment.product
            if p == "force_chat":
                user.force_chats_used = max(0, user.force_chats_used - 1)
            elif p == "boost":
                user.superlikes_left += 3
            elif p == "superlike":
                user.superlikes_left += 1
            elif p == "vip_signal":
                user.vip_signals_used = max(0, user.vip_signals_used - 1)
            elif p == "premium_month":
                user.tier = TierEnum.premium
                user.swipes_left = 200
                user.superlikes_left = 5
            elif p == "kupidon_month":
                user.tier = TierEnum.kupidon
                user.swipes_left = 500
                user.superlikes_left = 5
                user.is_oligarch_mode = True
        await db.commit()
    await message.answer(f"✅ Оплата прошла! «{payment.product}» активирован 💘")
