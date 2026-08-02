import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Load variables from the .env file
load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    # Build the connection string
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_HOST = os.getenv("DB_HOST")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME")

    SQLALCHEMY_DATABASE_URL = (
        f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

# Core interface to the db
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Temporary workspace for db queries
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Parent class for all future db models
Base = declarative_base()


# Dependency to get a db session for each request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    try:
        with engine.connect() as connection:
            print("✅ Connection to the PostgreSQL database was successful!")
    except Exception as e:
        print("❌ Connection failed!")
        print(f"Error details: {e}")
