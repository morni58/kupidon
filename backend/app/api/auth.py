import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.deps import get_db
from app.core.security import verify_telegram_init_data, create_jwt
from app.models.user import User
from app.schemas.auth import InitDataRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/telegram", response_model=TokenResponse)
async def auth_telegram(body: InitDataRequest, db: AsyncSession = Depends(get_db)):
    params = verify_telegram_init_data(body.init_data)
    if not params:
        raise HTTPException(status_code=401, detail="Invalid initData")

    tg_user_raw = params.get("user", "{}")
    try:
        tg_user = json.loads(tg_user_raw)
    except Exception:
        raise HTTPException(status_code=401, detail="Malformed user data")

    tg_id = int(tg_user.get("id", 0))
    if not tg_id:
        raise HTTPException(status_code=401, detail="No tg_id")

    result = await db.execute(select(User).where(User.tg_id == tg_id))
    user = result.scalar_one_or_none()
    is_new = user is None

    if not user:
        # Anti-fraud: account without username gets a lower trust baseline.
        username = tg_user.get("username")
        trust = 50
        if username:
            trust += 15
        if tg_user.get("is_premium"):
            trust += 10
        if tg_user.get("photo_url"):
            trust += 5
        trust = min(trust, 100)

        user = User(
            tg_id=tg_id,
            username=username,
            name=tg_user.get("first_name", "User"),
            birth_date=None,  # will be set during onboarding
            gender=None,
            search_gender=None,
            trust_score=trust,
        )
        db.add(user)
        await db.flush()
    else:
        user.username = tg_user.get("username")

    await db.commit()
    token = create_jwt(str(user.id))
    return TokenResponse(access_token=token, is_new_user=is_new)
