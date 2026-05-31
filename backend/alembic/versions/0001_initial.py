"""Initial schema — CupidBot v3.0

Revision ID: 0001
Revises:
Create Date: 2026-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ENUMS
    gender_enum = postgresql.ENUM("male", "female", name="genderenum", create_type=False)
    search_gender_enum = postgresql.ENUM("male", "female", "any", name="searchgenderenum", create_type=False)
    tier_enum = postgresql.ENUM("free", "premium", "kupidon", name="tierenum", create_type=False)
    action_enum = postgresql.ENUM("left", "right", "superlike", name="actiontypeenum", create_type=False)
    media_type_enum = postgresql.ENUM("photo", "video", name="mediatypeenum", create_type=False)
    msg_type_enum = postgresql.ENUM("text", "media", "system", "consent", "icebreaker", name="msgtypeenum", create_type=False)
    report_reason_enum = postgresql.ENUM("fake", "spam", "abuse", "nsfw", "underage", "fraud", name="reportreasonenum", create_type=False)
    report_status_enum = postgresql.ENUM("open", "reviewed", "dismissed", name="reportstatusenum", create_type=False)
    payment_status_enum = postgresql.ENUM("pending", "paid", "refunded", name="paymentstatusenum", create_type=False)

    for e in [gender_enum, search_gender_enum, tier_enum, action_enum,
              media_type_enum, msg_type_enum, report_reason_enum,
              report_status_enum, payment_status_enum]:
        e.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tg_id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(64)),
        sa.Column("name", sa.String(50), nullable=False, server_default="User"),
        sa.Column("birth_date", sa.Date()),
        sa.Column("gender", sa.Enum("male", "female", name="genderenum")),
        sa.Column("search_gender", sa.Enum("male", "female", "any", name="searchgenderenum")),
        sa.Column("city_id", sa.Integer()),
        sa.Column("lat", sa.Numeric(9, 6)),
        sa.Column("lng", sa.Numeric(9, 6)),
        sa.Column("bio", sa.String(150)),
        sa.Column("profile_score", sa.SmallInteger(), server_default="0"),
        sa.Column("trust_score", sa.SmallInteger(), server_default="50"),
        sa.Column("streak_days", sa.SmallInteger(), server_default="0"),
        sa.Column("tier", sa.Enum("free", "premium", "kupidon", name="tierenum"), server_default="free"),
        sa.Column("swipes_left", sa.Integer(), server_default="50"),
        sa.Column("force_chats_used", sa.Integer(), server_default="0"),
        sa.Column("superlikes_left", sa.Integer(), server_default="0"),
        sa.Column("vip_signals_used", sa.Integer(), server_default="0"),
        sa.Column("stars_balance", sa.Integer(), server_default="0"),
        sa.Column("is_verified", sa.Boolean(), server_default="false"),
        sa.Column("is_18_mode_active", sa.Boolean(), server_default="false"),
        sa.Column("is_stealth_mode", sa.Boolean(), server_default="false"),
        sa.Column("is_oligarch_mode", sa.Boolean(), server_default="false"),
        sa.Column("is_anti_oligarch", sa.Boolean(), server_default="false"),
        sa.Column("is_shadowbanned", sa.Boolean(), server_default="false"),
        sa.Column("is_banned", sa.Boolean(), server_default="false"),
        sa.Column("ban_reason", sa.String(200)),
        sa.Column("needs_review", sa.Boolean(), server_default="false"),
        sa.Column("last_streak_date", sa.Date()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("last_active_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_users_tg_id", "users", ["tg_id"], unique=True)
    op.create_index("idx_users_feed", "users", ["gender", "is_shadowbanned", "is_stealth_mode", "is_banned", "city_id"])
    op.create_index("idx_users_18", "users", ["is_18_mode_active", "gender"])
    op.create_index("idx_users_anti", "users", ["is_anti_oligarch"])

    op.create_table(
        "swipes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action_type", sa.Enum("left", "right", "superlike", name="actiontypeenum"), nullable=False),
        sa.Column("is_vip_like", sa.Boolean(), server_default="false"),
        sa.Column("vip_message", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_unique_constraint("idx_swipes_pair", "swipes", ["actor_id", "target_id"])
    op.create_index("idx_swipes_actor", "swipes", ["actor_id"])
    op.create_index("idx_swipes_target", "swipes", ["target_id"])

    op.create_table(
        "matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user1_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user2_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_force_chat", sa.Boolean(), server_default="false"),
        sa.Column("is_18_room", sa.Boolean(), server_default="false"),
        sa.Column("is_oligarch_reveal", sa.Boolean(), server_default="false"),
        sa.Column("tg_unlocked_user1", sa.Boolean(), server_default="false"),
        sa.Column("tg_unlocked_user2", sa.Boolean(), server_default="false"),
        sa.Column("messages_count", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_matches_user1", "matches", ["user1_id"])
    op.create_index("idx_matches_user2", "matches", ["user2_id"])

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text()),
        sa.Column("media_url", sa.String(500)),
        sa.Column("is_disappearing", sa.Boolean(), server_default="false"),
        sa.Column("is_burned", sa.Boolean(), server_default="false"),
        sa.Column("msg_type", sa.Enum("text", "media", "system", "consent", "icebreaker", name="msgtypeenum"), server_default="text"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_msg_match", "messages", ["match_id", "created_at"])

    op.create_table(
        "media_slots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("media_url", sa.String(500)),
        sa.Column("media_type", sa.Enum("photo", "video", name="mediatypeenum")),
        sa.Column("nsfw_score", sa.Numeric(3, 2)),
        sa.Column("slot_index", sa.SmallInteger(), nullable=False),
    )
    op.create_unique_constraint("uq_media_slot", "media_slots", ["user_id", "slot_index"])
    op.create_index("idx_media_user", "media_slots", ["user_id"])

    op.create_table(
        "admin_tags",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(30), nullable=False),
        sa.Column("color_hex", sa.String(7), server_default="#FF00FF"),
        sa.Column("emoji", sa.String(10)),
        sa.Column("is_18_only", sa.Boolean(), server_default="false"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
    )

    op.create_table(
        "user_tags",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "tag_id"),
    )

    op.create_table(
        "vip_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("swipe_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_revealed", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_vip_target", "vip_notifications", ["target_id", "is_revealed"])

    op.create_table(
        "profile_views",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("viewer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_unique_constraint("uq_profile_view", "profile_views", ["viewer_id", "target_id"])
    op.create_index("idx_views_target", "profile_views", ["target_id", "created_at"])

    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.Enum("fake", "spam", "abuse", "nsfw", "underage", "fraud", name="reportreasonenum"), nullable=False),
        sa.Column("status", sa.Enum("open", "reviewed", "dismissed", name="reportstatusenum"), server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_reports_target", "reports", ["target_id"])

    op.create_table(
        "blocks",
        sa.Column("blocker_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("blocked_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("blocker_id", "blocked_id"),
    )

    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_payload", sa.String(200), nullable=False, unique=True),
        sa.Column("stars", sa.Integer(), nullable=False),
        sa.Column("product", sa.String(100), nullable=False),
        sa.Column("status", sa.Enum("pending", "paid", "refunded", name="paymentstatusenum"), server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_payments_user", "payments", ["user_id"])

    op.create_table(
        "config",
        sa.Column("key", sa.String(50), primary_key=True),
        sa.Column("value", sa.String(200), nullable=False),
    )

    op.create_table(
        "cities",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("region", sa.String(100)),
        sa.Column("country", sa.String(2), server_default="RU"),
        sa.Column("lat", sa.Numeric(9, 6), nullable=False),
        sa.Column("lng", sa.Numeric(9, 6), nullable=False),
    )
    op.create_index("idx_cities_name", "cities", ["name"])

    # Seed major RU/UA cities
    op.execute("""
        INSERT INTO cities (name, region, country, lat, lng) VALUES
        ('Москва', 'Москва', 'RU', 55.755826, 37.617300),
        ('Санкт-Петербург', 'СПб', 'RU', 59.934280, 30.335099),
        ('Новосибирск', 'НСО', 'RU', 55.030199, 82.920430),
        ('Екатеринбург', 'СО', 'RU', 56.838011, 60.597465),
        ('Казань', 'РТ', 'RU', 55.796127, 49.106405),
        ('Нижний Новгород', 'НО', 'RU', 56.296504, 43.936059),
        ('Челябинск', 'ЧО', 'RU', 55.159897, 61.402554),
        ('Самара', 'СО', 'RU', 53.195873, 50.100193),
        ('Омск', 'ОО', 'RU', 54.989347, 73.368221),
        ('Ростов-на-Дону', 'РО', 'RU', 47.222078, 39.720349),
        ('Уфа', 'РБ', 'RU', 54.735152, 55.958736),
        ('Краснодар', 'КК', 'RU', 45.035470, 38.975313),
        ('Воронеж', 'ВО', 'RU', 51.660781, 39.200269),
        ('Пермь', 'ПК', 'RU', 58.010455, 56.229443),
        ('Волгоград', 'ВО', 'RU', 48.707073, 44.516975),
        ('Сочи', 'КК', 'RU', 43.585472, 39.723098),
        ('Киев', 'Київ', 'UA', 50.450100, 30.523400),
        ('Харьков', 'ХО', 'UA', 49.993500, 36.230383),
        ('Одесса', 'ОО', 'UA', 46.482526, 30.723309),
        ('Минск', 'Минск', 'BY', 53.904541, 27.561523)
    """)

    # Seed default tags
    op.execute("""
        INSERT INTO admin_tags (name, color_hex, emoji, is_18_only) VALUES
        ('Спорт', '#FF66CC', '🏋️', false),
        ('Музыка', '#FF00FF', '🎵', false),
        ('Путешествия', '#10B981', '✈️', false),
        ('Кино', '#3B82F6', '🎬', false),
        ('Неформалка', '#8B5CF6', '💀', false),
        ('Кошки', '#F59E0B', '🐱', false),
        ('Собаки', '#EF4444', '🐶', false),
        ('Скейт', '#6366F1', '🛹', false),
        ('Программирование', '#14B8A6', '💻', false),
        ('Готовка', '#F97316', '🍳', false),
        ('Без обязательств', '#FF3333', '🎲', true),
        ('Один вечер', '#CC0000', '🌙', true),
        ('Открытые отн.', '#FF6666', '💫', true),
        ('Анонимно', '#990000', '🎭', true)
    """)


def downgrade():
    for table in ["cities", "config", "payments", "blocks", "reports", "profile_views",
                  "vip_notifications", "user_tags", "admin_tags", "media_slots",
                  "messages", "matches", "swipes", "users"]:
        op.drop_table(table)
    for enum in ["genderenum", "searchgenderenum", "tierenum", "actiontypeenum",
                 "mediatypeenum", "msgtypeenum", "reportreasonenum",
                 "reportstatusenum", "paymentstatusenum"]:
        op.execute(f"DROP TYPE IF EXISTS {enum}")
