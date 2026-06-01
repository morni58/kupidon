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
            from app.services.payments_apply import apply_payment_effect
            await apply_payment_effect(user, payment.product, payment.stars)
        await db.commit()
    await message.answer(f"✅ Оплата прошла! «{payment.product}» активирован 💘")
