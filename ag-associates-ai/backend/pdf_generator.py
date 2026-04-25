"""
PDF Generator Module for AG Associates AI
Converts markdown/text agreements to formatted PDF documents using ReportLab
"""

from reportlab.lib import colors, styles, units
from reportlab.lib.pagesizes import A4, letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
from datetime import datetime
from typing import Optional
import re


class AgreementPDFGenerator:
    """
    Generates professional PDF rental agreements from markdown content
    """
    
    def __init__(self, output_dir: str = None):
        if output_dir is None:
            from config import OUTPUT_DIR
            self.output_dir = OUTPUT_DIR
        else:
            self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Initialize styles
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Create custom paragraph styles for legal documents"""
        
        # Title style
        self.styles.add(ParagraphStyle(
            name='AgreementTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=colors.darkblue,
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))
        
        # Section headers
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.darkblue,
            spaceBefore=20,
            spaceAfter=12,
            fontName='Helvetica-Bold'
        ))
        
        # Body text with justification
        self.styles.add(ParagraphStyle(
            name='BodyJustified',
            parent=self.styles['Normal'],
            fontSize=11,
            alignment=TA_JUSTIFY,
            firstLineIndent=0,
            spaceBefore=6,
            spaceAfter=6,
            leading=14
        ))
        
        # Signature style
        self.styles.add(ParagraphStyle(
            name='Signature',
            parent=self.styles['Normal'],
            fontSize=11,
            spaceBefore=30,
            spaceAfter=50
        ))
    
    def _clean_markdown(self, text: str) -> str:
        """Clean markdown formatting for ReportLab"""
        # Remove markdown headers and convert to plain text with spacing
        text = re.sub(r'^### (.+)$', r'\1', text, flags=re.MULTILINE)
        text = re.sub(r'^## (.+)$', r'\1', text, flags=re.MULTILINE)
        text = re.sub(r'^# (.+)$', r'\1', text, flags=re.MULTILINE)
        
        # Remove bold/italic markers
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
        text = re.sub(r'\*(.+?)\*', r'\1', text)
        text = re.sub(r'__(.+?)__', r'\1', text)
        
        # Escape special characters for ReportLab
        text = text.replace('&', '&amp;')
        text = text.replace('<', '&lt;')
        text = text.replace('>', '&gt;')
        
        return text
    
    def _parse_content_to_flowables(self, content: str) -> list:
        """
        Parse markdown content into ReportLab flowables
        """
        flowables = []
        lines = content.split('\n')
        
        current_section = None
        current_paragraph = []
        
        for line in lines:
            line = line.strip()
            
            if not line:
                # Empty line - end current paragraph
                if current_paragraph:
                    para_text = ' '.join(current_paragraph)
                    flowables.append(Paragraph(para_text, self.styles['BodyJustified']))
                    current_paragraph = []
                continue
            
            # Check for headers
            if line.startswith('###'):
                # Save any pending paragraph
                if current_paragraph:
                    para_text = ' '.join(current_paragraph)
                    flowables.append(Paragraph(para_text, self.styles['BodyJustified']))
                    current_paragraph = []
                
                section_title = self._clean_markdown(line[3:].strip())
                flowables.append(Paragraph(section_title, self.styles['SectionHeader']))
                current_section = section_title
                continue
            
            if line.startswith('##'):
                if current_paragraph:
                    para_text = ' '.join(current_paragraph)
                    flowables.append(Paragraph(para_text, self.styles['BodyJustified']))
                    current_paragraph = []
                
                section_title = self._clean_markdown(line[2:].strip())
                flowables.append(Paragraph(section_title, self.styles['SectionHeader']))
                current_section = section_title
                continue
            
            if line.startswith('#'):
                if current_paragraph:
                    para_text = ' '.join(current_paragraph)
                    flowables.append(Paragraph(para_text, self.styles['BodyJustified']))
                    current_paragraph = []
                
                title = self._clean_markdown(line[1:].strip())
                flowables.append(Paragraph(title, self.styles['AgreementTitle']))
                flowables.append(Spacer(1, 20))
                continue
            
            # Regular paragraph text
            cleaned_line = self._clean_markdown(line)
            current_paragraph.append(cleaned_line)
        
        # Add any remaining paragraph
        if current_paragraph:
            para_text = ' '.join(current_paragraph)
            flowables.append(Paragraph(para_text, self.styles['BodyJustified']))
        
        return flowables
    
    def generate_pdf(self, content: str, filename: Optional[str] = None) -> str:
        """
        Generate a PDF from agreement content
        
        Args:
            content: The agreement text/markdown content
            filename: Optional filename (without .pdf extension)
        
        Returns:
            Path to the generated PDF file
        """
        if filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"agreement_{timestamp}"
        
        pdf_path = os.path.join(self.output_dir, f"{filename}.pdf")
        
        # Create the PDF document
        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=A4,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72,
            title="Rental Agreement"
        )
        
        # Parse content into flowables
        flowables = self._parse_content_to_flowables(content)
        
        # Add signature section if not present
        flowables.append(Spacer(1, 40))
        flowables.append(Paragraph("_________________________", self.styles['Signature']))
        flowables.append(Paragraph("Landlord Signature", self.styles['BodyJustified']))
        
        flowables.append(Spacer(1, 20))
        flowables.append(Paragraph("_________________________", self.styles['Signature']))
        flowables.append(Paragraph("Tenant Signature", self.styles['BodyJustified']))
        
        flowables.append(Spacer(1, 20))
        execution_date = datetime.now().strftime("%B %d, %Y")
        flowables.append(Paragraph(f"Date: {execution_date}", self.styles['BodyJustified']))
        
        # Build the PDF
        doc.build(flowables)
        
        return pdf_path


def convert_to_pdf(content: str, sender: str = "user") -> str:
    """
    Convenience function to convert agreement content to PDF
    
    Args:
        content: Agreement text content
        sender: Identifier for the sender (used in filename)
    
    Returns:
        Path to generated PDF
    """
    generator = AgreementPDFGenerator()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"agreement_{sender}_{timestamp}"
    
    pdf_path = generator.generate_pdf(content, filename)
    return pdf_path


# Test the PDF generator
if __name__ == "__main__":
    test_content = """
    # RENTAL AGREEMENT
    
    ## PARTIES
    This Rental Agreement is made between Suresh Deshmukh (Landlord) and Rahul Patil (Tenant).
    
    ## PROPERTY
    The property located at Flat 201, Krishna Heights, Karve Road, Pune 411004.
    
    ## TERM AND RENT
    The agreement is for 11 months starting March 1st, 2024. Monthly rent is ₹28,000.
    
    ## SECURITY DEPOSIT
    Security deposit of ₹84,000 has been paid.
    
    ## OBLIGATIONS
    Tenant agrees to maintain the property in good condition.
    """
    
    pdf_path = convert_to_pdf(test_content, "test_user")
    print(f"✅ PDF generated: {pdf_path}")
