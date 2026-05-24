import os
import sys

# Add backend directory to path
sys.path.append('d:/Apps/Sunny/Sunny/AI Interview System/backend')

from dotenv import load_dotenv
load_dotenv('d:/Apps/Sunny/Sunny/AI Interview System/backend/.env')

from utils.email_service import send_otp_email

# Attempt to send an email
print("Testing Brevo API...")
success, msg = send_otp_email("sunnyanjanigupta@gmail.com", "Test User", "123456")

if success:
    print(f"SUCCESS! Message ID: {msg}")
else:
    print(f"FAILED! Error: {msg}")
