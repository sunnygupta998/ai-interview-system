import PyPDF2
import re

def extract_text_from_pdf(file_path):
    """
    Extracts and cleans text from a PDF file.
    """
    text = ""
    try:
        with open(file_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            num_pages = len(reader.pages)
            for page_num in range(num_pages):
                page = reader.pages[page_num]
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        
        # Basic cleaning of whitespace and multiple newlines
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
    except Exception as e:
        print(f"Error reading PDF {file_path}: {str(e)}")
        raise e
        
    return text
