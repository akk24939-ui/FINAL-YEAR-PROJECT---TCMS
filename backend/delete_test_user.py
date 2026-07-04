import os
import sys

from app.db.session import SessionLocal
from app.models.user import User

def main():
    db = SessionLocal()
    try:
        deleted = db.query(User).filter(
            (User.email == "akk24939@gmail.com") | (User.mobile_number == "8148185308")
        ).delete(synchronize_session=False)
        db.commit()
        print(f"Deleted {deleted} users")
    finally:
        db.close()

if __name__ == "__main__":
    main()
