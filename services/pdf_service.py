import io
import re
import html

# Safe conditional import of ReportLab
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Preformatted
    )
    from reportlab.pdfgen import canvas
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


if REPORTLAB_AVAILABLE:
    class NumberedCanvas(canvas.Canvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._saved_page_states = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            num_pages = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self.draw_page_decorations(num_pages)
                super().showPage()
            super().save()

        def draw_page_decorations(self, page_count):
            self.saveState()
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748B"))
            
            # Header rule & title
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(36, 756, 576, 756)
            self.drawString(36, 762, "NEXUSEDU AI • Department of Computer Science & Engineering")
            self.drawRightString(576, 762, "Official Coursework Specification")

            # Footer rule & numbering
            self.line(36, 42, 576, 42)
            self.drawString(36, 30, "NexusEdu AI Campus Platform • Verified Academic Document")
            self.drawRightString(576, 30, f"Page {self._pageNumber} of {page_count}")
            self.restoreState()


def _generate_reportlab_pdf_bytes(assignment: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0F172A')
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#4F46E5')
    )
    
    sec_heading = ParagraphStyle(
        'SecHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=15,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=8,
        spaceAfter=3
    )
    
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor('#334155')
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#0F172A')
    )

    elements = []
    
    # Institution & Subtitle Banner
    elements.append(Paragraph("GL BAJAJ INSTITUTE OF TECHNOLOGY & MANAGEMENT • AUTONOMOUS", subtitle_style))
    elements.append(Spacer(1, 3))
    
    # Assignment Title
    raw_title = assignment.get('title', 'Coursework Assignment Specification')
    elements.append(Paragraph(html.escape(str(raw_title)), title_style))
    elements.append(Spacer(1, 7))
    
    # Metadata Grid
    subject = assignment.get('subject', 'Computer Science & Engineering')
    code = assignment.get('subject_code', 'CS-401')
    section = assignment.get('section', 'All Sections')
    due_date = assignment.get('due_date') or assignment.get('dueDate', 'Scheduled')
    points = assignment.get('total_points') or assignment.get('totalPoints', 100)
    difficulty = assignment.get('difficulty', 'Medium')
    faculty = assignment.get('faculty_name', 'Faculty Supervisor')
    tags = assignment.get('tags', 'Algorithms, Coursework')
    if isinstance(tags, list):
        tags = ', '.join(tags)

    meta_data = [
        [
            Paragraph(f"<b>Course:</b> {html.escape(str(subject))}", body_style),
            Paragraph(f"<b>Course Code:</b> {html.escape(str(code))}", body_style),
            Paragraph(f"<b>Target Section:</b> {html.escape(str(section))}", body_style),
        ],
        [
            Paragraph(f"<b>Due Date:</b> {html.escape(str(due_date))}", body_style),
            Paragraph(f"<b>Maximum Score:</b> {html.escape(str(points))} Points", body_style),
            Paragraph(f"<b>Difficulty Tier:</b> {html.escape(str(difficulty))}", body_style),
        ],
        [
            Paragraph(f"<b>Faculty In-Charge:</b> {html.escape(str(faculty))}", body_style),
            Paragraph(f"<b>Keywords / Tags:</b> {html.escape(str(tags))}", body_style),
            Paragraph("<b>Verification:</b> NexusEdu AI AST Verified", body_style),
        ]
    ]
    
    meta_table = Table(meta_data, colWidths=[180, 180, 180])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 9))
    
    # 1. Description & Requirements Section
    elements.append(Paragraph("1. Problem Statement & Functional Requirements", sec_heading))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#4F46E5"), spaceAfter=5))
    
    desc_raw = assignment.get('description', '')
    rubric_match = re.search(r'Grading Rubric:\s*(.*)', desc_raw, re.DOTALL | re.IGNORECASE)
    main_desc = desc_raw[:rubric_match.start()].strip() if rubric_match else desc_raw.strip()
    
    for line in main_desc.split('\n'):
        line_s = line.strip()
        if not line_s:
            elements.append(Spacer(1, 3))
            continue
        if line_s.startswith('###'):
            elements.append(Paragraph(f"<b>{html.escape(line_s.replace('###', '').strip())}</b>", sec_heading))
        elif line_s.startswith('- ') or line_s.startswith('* '):
            content = html.escape(line_s[2:].strip())
            content = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', content)
            elements.append(Paragraph(f"• {content}", body_style))
        elif re.match(r'^\d+\.', line_s):
            content = html.escape(line_s)
            content = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', content)
            elements.append(Paragraph(content, body_style))
        else:
            content = html.escape(line_s)
            content = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', content)
            elements.append(Paragraph(content, body_style))
    
    elements.append(Spacer(1, 8))
    
    # 2. Structured Rubric Table
    rubric_items = assignment.get('rubric')
    if not rubric_items and rubric_match:
        rubric_text = rubric_match.group(1).strip()
        parsed_items = []
        for r_line in rubric_text.split('\n'):
            m = re.match(r'[-*]\s*([^(]+)\s*\(([^)]+)\):\s*(.*)', r_line.strip())
            if m:
                crit, pts, notes = m.groups()
                parsed_items.append({'criterion': crit.strip(), 'points': pts.replace('pts','').strip(), 'description': notes.strip()})
        if parsed_items:
            rubric_items = parsed_items

    if not rubric_items:
        rubric_items = [
            {'criterion': 'Algorithmic Logic & Correctness', 'points': 40, 'description': 'Meets functional constraints, passes edge cases and test assertions'},
            {'criterion': 'Time & Space Complexity', 'points': 30, 'description': 'Adheres to optimal Big-O bounds without memory leaks'},
            {'criterion': 'Code Quality & Documentation', 'points': 30, 'description': 'Clean modular functions, typing, comments, and submission notes'}
        ]

    elements.append(Paragraph("2. Official Grading Rubric", sec_heading))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#4F46E5"), spaceAfter=5))
    
    rubric_table_data = [
        [
            Paragraph("<b>Evaluation Criterion</b>", body_style),
            Paragraph("<b>Max Pts</b>", body_style),
            Paragraph("<b>Performance Benchmark & Expectations</b>", body_style)
        ]
    ]
    for r in rubric_items:
        rubric_table_data.append([
            Paragraph(f"<b>{html.escape(str(r.get('criterion', 'Criterion')))}</b>", body_style),
            Paragraph(f"<font color='#4F46E5'><b>{html.escape(str(r.get('points', 30)))} pts</b></font>", body_style),
            Paragraph(html.escape(str(r.get('description', r.get('notes', 'Meets standards')))), body_style)
        ])
    
    rubric_table = Table(rubric_table_data, colWidths=[150, 70, 320])
    rubric_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#EEF2F6')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(rubric_table)
    elements.append(Spacer(1, 8))

    # 3. Starter Boilerplate Code
    starter_code = assignment.get('starter_code') or assignment.get('starterCode') or ''
    starter_code = starter_code.strip()
    if starter_code:
        elements.append(Paragraph("3. Starter Boilerplate & Implementation Template", sec_heading))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#4F46E5"), spaceAfter=5))
        
        code_box_data = [[Preformatted(starter_code[:1200], code_style)]]
        code_table = Table(code_box_data, colWidths=[540])
        code_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 7),
            ('RIGHTPADDING', (0,0), (-1,-1), 7),
        ]))
        elements.append(code_table)
        elements.append(Spacer(1, 8))

    # 4. Submission Instructions
    elements.append(Paragraph("4. Submission Instructions & AI Integrity Policy", sec_heading))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#4F46E5"), spaceAfter=5))
    
    sub_instructions = (
        "• <b>Submission Channel:</b> Submissions must be submitted directly through the <i>NexusEdu AI</i> student dashboard under this designated assignment.<br/>"
        "• <b>Acceptable Deliverables:</b> GitHub repository URL with commit history, uploaded source archive (.py, .zip, .java), or code implementation approach notes.<br/>"
        "• <b>Automated Evaluation:</b> Submissions are verified through the closed-loop Gemini AI assessment pipeline, which scores criteria against the rubric and updates student completion status.<br/>"
        "• <b>Plagiarism & Integrity:</b> Originality is strictly enforced. Unauthorized code duplication across cohorts is flagged automatically."
    )
    elements.append(Paragraph(sub_instructions, body_style))

    doc.build(elements, canvasmaker=NumberedCanvas)
    return buffer.getvalue()


def _generate_pure_pdf_bytes(assignment: dict) -> bytes:
    """Zero-dependency pure Python PDF generator fallback."""
    def esc(s):
        return str(s).replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

    title = assignment.get('title', 'Assignment Specification')
    subject = assignment.get('subject', 'Computer Science & Engineering')
    code = assignment.get('subject_code', 'CS-401')
    section = assignment.get('section', 'All Sections')
    due_date = assignment.get('due_date') or assignment.get('dueDate', 'Scheduled')
    points = assignment.get('total_points') or assignment.get('totalPoints', 100)
    desc = assignment.get('description', '')

    lines = [
        ('F2', 14, 50, 750, 'NEXUSEDU AI - OFFICIAL ASSIGNMENT SPECIFICATION'),
        ('F1', 9, 50, 735, 'GL Bajaj Institute of Technology & Management | Session 2026-2027'),
        ('F2', 12, 50, 705, esc(title[:70])),
        ('F1', 9, 50, 680, esc(f"Course: {subject} ({code}) | Section: {section}")),
        ('F1', 9, 50, 665, esc(f"Due Date: {due_date} | Maximum Score: {points} Points")),
        ('F2', 10, 50, 640, 'Problem Statement & Requirements:'),
    ]

    y = 622
    for line in desc.split('\n')[:25]:
        if line.strip() and y > 80:
            lines.append(('F1', 8.5, 50, y, esc(line[:95])))
            y -= 13

    if y > 100:
        y -= 10
        lines.append(('F2', 9.5, 50, y, 'Submission & AI Assessment Notice:'))
        y -= 13
        lines.append(('F1', 8, 50, y, 'Submit your solution under this designated assignment in NexusEdu AI.'))
        y -= 11
        lines.append(('F1', 8, 50, y, 'Submissions are evaluated by Gemini AI against rubrics to mark completion.'))

    stream = ''
    for font, sz, x, ypos, text in lines:
        stream += f'BT /{font} {sz} Tf {x} {ypos} Td ({text}) Tj ET\n'

    stream_bytes = stream.encode('latin1', errors='ignore')
    stream_len = len(stream_bytes)

    obj1 = b'1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'
    obj2 = b'2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'
    obj3 = b'3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n'
    obj4 = f'4 0 obj\n<< /Length {stream_len} >>\nstream\n'.encode('ascii') + stream_bytes + b'\nendstream\nendobj\n'
    obj5 = b'5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
    obj6 = b'6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n'

    header = b'%PDF-1.4\n'
    offsets = [0]
    pos = len(header)
    body_data = b''
    for obj in [obj1, obj2, obj3, obj4, obj5, obj6]:
        offsets.append(pos)
        body_data += obj
        pos += len(obj)

    xref_pos = pos
    xref = f'xref\n0 7\n0000000000 65535 f \n'.encode('ascii')
    for off in offsets[1:]:
        xref += f'{off:010d} 00000 n \n'.encode('ascii')
    trailer = f'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n'.encode('ascii')

    return header + body_data + xref + trailer


def generate_assignment_pdf_bytes(assignment: dict) -> bytes:
    """
    Renders an official university coursework assignment sheet in PDF format.
    Uses ReportLab when available; otherwise falls back gracefully to a pure-Python PDF generator.
    """
    if REPORTLAB_AVAILABLE:
        try:
            return _generate_reportlab_pdf_bytes(assignment)
        except Exception:
            return _generate_pure_pdf_bytes(assignment)
    return _generate_pure_pdf_bytes(assignment)
