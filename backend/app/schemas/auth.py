from pydantic import BaseModel


class InitDataRequest(BaseModel):
    init_data: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_new_user: bool
