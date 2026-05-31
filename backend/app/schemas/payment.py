from pydantic import BaseModel
import uuid


class PaymentCreate(BaseModel):
    product: str
    stars: int


class PaymentWebhook(BaseModel):
    invoice_payload: str
    telegram_payment_charge_id: str
    total_amount: int
    currency: str
