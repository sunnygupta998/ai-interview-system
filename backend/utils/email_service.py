import os
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException

def send_transactional_email(to_email, to_name, subject, html_content):
    """
    Sends a transactional email using the Brevo (Sendinblue) API.
    """
    api_key = os.getenv('BREVO_API_KEY')
    sender_email = os.getenv('BREVO_SENDER_EMAIL')

    if not api_key or not sender_email:
        print("Warning: BREVO_API_KEY or BREVO_SENDER_EMAIL not set in .env. Email not sent.")
        return False, "Missing credentials"

    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = api_key

    # Initialize the Transactional Emails API instance
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
    
    sender = {"name": "AI Interview System", "email": sender_email}
    to = [{"email": to_email, "name": to_name}]
    
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=to,
        sender=sender,
        subject=subject,
        html_content=html_content
    )
    
    try:
        api_response = api_instance.send_transac_email(send_smtp_email)
        print(f"Email sent successfully to {to_email}. Message ID: {api_response.message_id}")
        return True, api_response.message_id
    except ApiException as e:
        print(f"Exception when calling TransactionalEmailsApi->send_transac_email: {e}")
        return False, str(e)

def send_candidate_results_email(to_email, to_name, score, decision, feedback):
    """
    Formats and sends the final AI Interview results to the candidate.
    """
    subject = "Your AI Interview Results are Ready!"
    
    color = "#00b894" if decision == "Selected" else "#ff7675"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #2d3436;">AI Interview System</h1>
            </div>
            
            <p>Hi {to_name},</p>
            <p>Thank you for completing your technical assessment and AI voice interview.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid {color};">
                <h2 style="margin-top: 0; color: {color};">Final Decision: {decision}</h2>
                <p style="font-size: 1.2em; font-weight: bold;">Overall Score: {score}/100</p>
            </div>
            
            <h3>AI Feedback</h3>
            <p style="white-space: pre-line;">{feedback}</p>
            
            <p style="margin-top: 30px;">
                You can log in to your dashboard at any time to view your detailed granular feedback, strengths, and areas for improvement.
            </p>
            
            <p>Best regards,<br>The Recruitment Team</p>
        </body>
    </html>
    """
    
    return send_transactional_email(to_email, to_name, subject, html_content)

def send_otp_email(to_email, to_name, otp_code):
    """
    Sends a 6-digit verification code to the user during registration.
    """
    subject = "Verify Your Email Address"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #2d3436;">AI Interview System</h1>
            </div>
            
            <p>Hi {to_name},</p>
            <p>Welcome to the AI Interview System! To complete your registration, please verify your email address using the code below:</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <h2 style="margin: 0; color: #0984e3; font-size: 32px; letter-spacing: 5px;">{otp_code}</h2>
            </div>
            
            <p>This code will expire in 10 minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
            
            <p>Best regards,<br>The Recruitment Team</p>
        </body>
    </html>
    """
    
    return send_transactional_email(to_email, to_name, subject, html_content)
