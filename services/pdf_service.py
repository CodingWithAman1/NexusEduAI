import io
import re
import html

# Safe conditional import of ReportLab
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Preformatted, KeepTogether
    )
    from reportlab.pdfgen import canvas
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


def parse_assignment_components(assignment: dict) -> dict:
    """
    Intelligently extracts overview, milestone questions, examples, constraints,
    rubric, and starter code from either structured dictionary fields or Markdown text.
    """
    overview = (assignment.get("overview") or "").strip()
    sections = list(assignment.get("sections") or assignment.get("questions") or [])
    examples = list(assignment.get("examples") or [])
    constraints = list(assignment.get("constraints") or [])
    rubric = list(assignment.get("rubric") or [])
    starter_code = (assignment.get("starter_code") or assignment.get("starterCode") or "").strip()

    desc = (assignment.get("description") or "").strip()

    # If any structured components are missing, parse from markdown description
    if desc and (not overview or not sections or not examples or not constraints or not rubric):
        sec_blocks = re.split(r'\n(?=###?\s+)', '\n' + desc)
        for sec in sec_blocks:
            sec = sec.strip()
            if not sec:
                continue

            # 1. Overview
            if re.search(r'###?\s*(?:1[.\s]+)?(?:Problem\s+)?Overview', sec, re.IGNORECASE):
                if not overview:
                    lines = sec.split('\n')[1:]
                    overview = '\n'.join(lines).strip()

            # 2. Assignment Tasks / Questions / Milestones
            elif re.search(r'###?\s*(?:2[.\s]+)?(?:Assignment\s+|Milestone\s+)?(?:Tasks?|Questions?|Deliverables?)', sec, re.IGNORECASE):
                if not sections:
                    q_blocks = re.split(r'\n(?=\d+\.\s+)', sec)
                    for qb in q_blocks:
                        qb = qb.strip()
                        m = re.match(r'(\d+)\.\s+\*\*(?:(?:Milestone|Question|Part|Task)\s*\d*:\s*)?([^*]+)\*\*(?:\s*\[(\d+)\s*pts\])?', qb, re.IGNORECASE)
                        if m:
                            q_num = int(m.group(1))
                            q_title = m.group(2).strip()
                            q_pts = int(m.group(3)) if m.group(3) else 30

                            task_m = re.search(r'[-*•]?\s*\*\*(?:Task(?:\s+Specification)?|Specification|Description)\*\*:\s*(.*?)(?=\n\s*[-*•]\s*\*\*Deliverable|\Z)', qb, re.DOTALL | re.IGNORECASE)
                            deliv_m = re.search(r'[-*•]?\s*\*\*Deliverable\*\*:\s*(.*?)(?=\n\d+\.|\Z)', qb, re.DOTALL | re.IGNORECASE)

                            details = task_m.group(1).strip() if task_m else qb[m.end():].strip()
                            details = re.sub(r'^[-*•]\s*', '', details).strip()
                            deliv = deliv_m.group(1).strip() if deliv_m else ""

                            sections.append({
                                "number": q_num,
                                "title": q_title,
                                "points": q_pts,
                                "details": details,
                                "content": details,
                                "deliverable": deliv
                            })

            # 3. Examples
            elif re.search(r'###?\s*(?:3[.\s]+)?(?:Concrete\s+)?Examples?', sec, re.IGNORECASE):
                if not examples:
                    ex_blocks = re.split(r'\n(?=\*\*(?:Example\s*\d*|Case\s*\d*)\*\*:?)', sec, flags=re.IGNORECASE)
                    for eb in ex_blocks:
                        eb = eb.strip()
                        m_hdr = re.match(r'\*\*(?:Example\s*(\d*)|Case\s*(\d*))\*\*:?', eb, re.IGNORECASE)
                        if m_hdr:
                            ex_idx = int(m_hdr.group(1) or m_hdr.group(2) or len(examples) + 1)

                            inp_m = re.search(r'[-*•]?\s*\*\*Input(?:\s*/\s*Operations?)?\*\*:\s*```(?:\w+)?\n?(.*?)```', eb, re.DOTALL | re.IGNORECASE)
                            if not inp_m:
                                inp_m = re.search(r'[-*•]?\s*\*\*Input(?:\s*/\s*Operations?)?\*\*:\s*`?(.*?)`?(?=\n[-*•]|\n\*\*|$)', eb, re.IGNORECASE)

                            out_m = re.search(r'[-*•]?\s*\*\*(?:Expected\s+)?Output\*\*:\s*`?(.*?)`?(?=\n[-*•]|\n\*\*|$)', eb, re.IGNORECASE)
                            expl_m = re.search(r'[-*•]?\s*\*\*(?:(?:Step-by-Step\s+)?Explanation|Trace(?:\s+Explanation)?)\*\*:\s*(.*?)(?=\n\*\*Example|\Z)', eb, re.DOTALL | re.IGNORECASE)

                            inp = inp_m.group(1).strip() if inp_m else ""
                            out = out_m.group(1).strip() if out_m else ""
                            expl = expl_m.group(1).strip() if expl_m else ""

                            if inp or out or expl:
                                examples.append({
                                    "example_num": ex_idx,
                                    "title": f"Example {ex_idx}",
                                    "input": inp,
                                    "output": out,
                                    "explanation": expl
                                })

            # 4. Constraints
            elif re.search(r'###?\s*(?:4[.\s]+)?(?:Technical\s+)?Constraints?', sec, re.IGNORECASE):
                if not constraints:
                    for line in sec.split('\n')[1:]:
                        line_s = line.strip()
                        if line_s.startswith(('-', '*', '•')):
                            c_item = line_s.lstrip('-*•').strip()
                            if c_item:
                                constraints.append(c_item)

            # 5. Rubric
            elif re.search(r'###?\s*(?:5[.\s]+)?(?:Grading\s+)?Rubric', sec, re.IGNORECASE):
                if not rubric:
                    for line in sec.split('\n')[1:]:
                        line_s = line.strip()
                        m = re.match(r'[-*•]\s*(?:\*\*)?([^*()]+?)(?:\*\*)?\s*\(([^)]+)\):\s*(.*)', line_s)
                        if m:
                            crit, pts_str, r_desc = m.groups()
                            pts_num = int(re.sub(r'[^\d]', '', pts_str) or 30)
                            rubric.append({
                                "criterion": crit.strip(),
                                "points": pts_num,
                                "description": r_desc.strip()
                            })

    # Default rubric if none was extracted or provided
    if not rubric:
        rubric = [
            {"criterion": "Algorithmic Logic & Functional Correctness", "points": 40, "description": "Passes all automated test suites, satisfies functional requirements, and guards against boundary cases"},
            {"criterion": "Time & Space Complexity Target Adherence", "points": 30, "description": "Adheres strictly to theoretical Big-O complexity bounds without excessive allocations"},
            {"criterion": "Code Quality, Architecture & Documentation", "points": 30, "description": "Modular design, type hints, informative docstrings, and comprehensive test harness"}
        ]

    return {
        "overview": overview or desc,
        "sections": sections,
        "questions": sections,
        "examples": examples,
        "constraints": constraints,
        "rubric": rubric,
        "starter_code": starter_code
    }


if REPORTLAB_AVAILABLE:
    class NumberedCanvas(canvas.Canvas):
        """Two-pass canvas for dynamic running headers, footers, and page counts."""
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

            # Header rule & title (Clean ASCII characters for universal PDF viewer compatibility)
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(36, 756, 576, 756)
            self.drawString(36, 762, "GL BAJAJ INSTITUTE OF TECHNOLOGY & MANAGEMENT | AUTONOMOUS")
            self.drawRightString(576, 762, "Department of Computer Science & Engineering")

            # Footer rule & numbering
            self.line(36, 42, 576, 42)
            self.drawString(36, 30, "NexusEdu AI Campus Platform | Verified Coursework Specification")
            self.drawRightString(576, 30, f"Page {self._pageNumber} of {page_count}")
            self.restoreState()


def _generate_reportlab_pdf_bytes(assignment: dict) -> bytes:
    """Renders a university publication-grade coursework assignment sheet using ReportLab."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=54,
        bottomMargin=54
    )

    parsed = parse_assignment_components(assignment)

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16.5,
        leading=20,
        textColor=colors.HexColor('#0F172A')
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#4F46E5')
    )

    sec_heading = ParagraphStyle(
        'SecHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=13.5,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=6,
        spaceAfter=2
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#334155')
    )

    example_label = ParagraphStyle(
        'ExLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1E293B')
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#0F172A')
    )

    elements = []

    # Institution & Subtitle Banner
    elements.append(Paragraph("GL BAJAJ INSTITUTE OF TECHNOLOGY & MANAGEMENT | AUTONOMOUS", subtitle_style))
    elements.append(Spacer(1, 2))

    # Assignment Title
    raw_title = assignment.get('title', 'Coursework Assignment Specification')
    elements.append(Paragraph(html.escape(str(raw_title)), title_style))
    elements.append(Spacer(1, 6))

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
            Paragraph("<b>Verification:</b> NexusEdu AI Automated Pipeline", body_style),
        ]
    ]

    meta_table = Table(meta_data, colWidths=[180, 180, 180])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 7))

    # 1. Problem Overview & Context
    overview_text = parsed.get('overview') or assignment.get('description', '')
    elements.append(Paragraph("1. Problem Overview & Theoretical Context", sec_heading))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#4F46E5"), spaceAfter=4))

    for line in overview_text.split('\n'):
        line_s = line.strip()
        if not line_s:
            elements.append(Spacer(1, 2))
            continue
        if line_s.startswith('###'):
            continue
        content = html.escape(line_s)
        content = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', content)
        if line_s.startswith(('-', '*', '•')):
            clean_bullet = line_s.lstrip('-*•').strip()
            elements.append(Paragraph(f"• {html.escape(clean_bullet)}", body_style))
        else:
            elements.append(Paragraph(content, body_style))
    elements.append(Spacer(1, 6))

    # 2. Assignment Tasks & Core Deliverables
    sections = parsed.get('sections') or parsed.get('questions') or []
    if sections:
        elements.append(Paragraph("2. Assignment Tasks & Core Deliverables", sec_heading))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#4F46E5"), spaceAfter=4))
        for idx, s in enumerate(sections, start=1):
            title = s.get('title') or f"Task {idx}"
            pts = s.get('points')
            content = s.get('content') or s.get('details') or ''
            deliv = s.get('deliverable', '')

            pts_html = f" &nbsp;&nbsp;<font color='#4F46E5'><b>[{pts} pts]</b></font>" if pts else ""
            s_header = f"<b>{html.escape(title)}</b>{pts_html}"
            elements.append(Paragraph(s_header, body_style))
            if content:
                clean_content = html.escape(content).replace('\n', '<br/>')
                elements.append(Paragraph(f"• <b>Specification:</b> {clean_content}", body_style))
            if deliv:
                elements.append(Paragraph(f"• <b>Deliverable:</b> {html.escape(deliv)}", body_style))
            elements.append(Spacer(1, 4))
        elements.append(Spacer(1, 3))

    # 3. Concrete Examples & Test Cases (Callout Boxes)
    examples = parsed.get('examples') or []
    if examples:
        elements.append(Paragraph("3. Concrete Examples & Test Traces", sec_heading))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#4F46E5"), spaceAfter=4))
        for idx, ex in enumerate(examples, start=1):
            ex_title = ex.get('title') or f"Example {ex.get('example_num', idx)}"
            inp = ex.get('input', '')
            out = ex.get('output', '')
            expl = ex.get('explanation', '')

            ex_rows = [
                [Paragraph(f"<b>{html.escape(ex_title)}</b>", example_label)],
                [Paragraph(f"<b>Input / Operations:</b><br/>{html.escape(inp).replace(chr(10), '<br/>')}", code_style)],
                [Paragraph(f"<b>Expected Output:</b> <font color='#047857'><b>{html.escape(out)}</b></font>", body_style)],
                [Paragraph(f"<b>Trace Explanation:</b> {html.escape(expl)}", body_style)]
            ]
            ex_table = Table(ex_rows, colWidths=[540])
            ex_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                ('LINEBEFORE', (0, 0), (0, -1), 2.5, colors.HexColor('#4F46E5')),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('LEFTPADDING', (0, 0), (-1, -1), 7),
                ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ]))
            elements.append(KeepTogether(ex_table))
            elements.append(Spacer(1, 5))
        elements.append(Spacer(1, 2))

    # 4. Input Constraints & Performance Targets
    constraints = parsed.get('constraints') or []
    if constraints:
        elements.append(Paragraph("4. Input Constraints & Performance Targets", sec_heading))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#4F46E5"), spaceAfter=4))
        c_lines = []
        for c in constraints:
            c_lines.append(f"• <font face='Courier'><b>{html.escape(c)}</b></font>" if any(k in c for k in ['<', '=', 'O(', '>', '^']) else f"• {html.escape(c)}")
        c_text = "<br/>".join(c_lines)
        c_box = Table([[Paragraph(c_text, body_style)]], colWidths=[540])
        c_box.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFFBEB')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#FDE68A')),
            ('LINEBEFORE', (0, 0), (0, -1), 2.5, colors.HexColor('#D97706')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 7),
            ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ]))
        elements.append(KeepTogether(c_box))
        elements.append(Spacer(1, 7))

    # 5. Official Grading Rubric Table
    rubric_items = parsed.get('rubric') or []
    if rubric_items:
        elements.append(Paragraph("5. Official Grading Rubric (100 Points Total)", sec_heading))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#4F46E5"), spaceAfter=4))

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
                Paragraph(html.escape(str(r.get('description', r.get('notes', 'Meets benchmark standards')))), body_style)
            ])

        rubric_table = Table(rubric_table_data, colWidths=[150, 70, 320])
        rubric_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#EEF2F6')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(KeepTogether(rubric_table))
        elements.append(Spacer(1, 7))

    # 6. Starter Boilerplate Code
    starter_code = parsed.get('starter_code', '')
    if starter_code:
        elements.append(Paragraph("6. Starter Boilerplate & Implementation Template", sec_heading))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#4F46E5"), spaceAfter=4))

        code_box_data = [[Preformatted(starter_code[:1500], code_style)]]
        code_table = Table(code_box_data, colWidths=[540])
        code_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(KeepTogether(code_table))
        elements.append(Spacer(1, 7))

    # 7. Submission Instructions & AI Integrity Policy
    elements.append(Paragraph("7. Submission Instructions & AI Integrity Policy", sec_heading))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#4F46E5"), spaceAfter=4))

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

    parsed = parse_assignment_components(assignment)
    title = assignment.get('title', 'Assignment Specification')
    subject = assignment.get('subject', 'Computer Science & Engineering')
    code = assignment.get('subject_code', 'CS-401')
    section = assignment.get('section', 'All Sections')
    due_date = assignment.get('due_date') or assignment.get('dueDate', 'Scheduled')
    points = assignment.get('total_points') or assignment.get('totalPoints', 100)

    lines = [
        ('F2', 13, 36, 750, 'NEXUSEDU AI | OFFICIAL COURSEWORK SPECIFICATION'),
        ('F1', 8.5, 36, 736, 'GL Bajaj Institute of Technology & Management | Autonomous'),
        ('F2', 12, 36, 712, esc(title[:75])),
        ('F1', 8.5, 36, 692, esc(f"Course: {subject} ({code}) | Section: {section}")),
        ('F1', 8.5, 36, 678, esc(f"Due Date: {due_date} | Maximum Score: {points} Points")),
    ]

    y = 654
    # 1. Overview
    if parsed.get('overview') and y > 80:
        lines.append(('F2', 9.5, 36, y, '1. Problem Overview:'))
        y -= 13
        for line in parsed['overview'].split('\n')[:5]:
            if line.strip() and y > 80:
                lines.append(('F1', 8, 36, y, esc(line.strip()[:100])))
                y -= 12

    # 2. Assignment Tasks / Questions
    sections_list = parsed.get('sections') or parsed.get('questions') or []
    if sections_list and y > 80:
        y -= 6
        lines.append(('F2', 9.5, 36, y, '2. Assignment Tasks & Deliverables:'))
        y -= 13
        for s in sections_list[:4]:
            if y > 80:
                s_title = s.get('title') or 'Task'
                s_pts = s.get('points', 30)
                lines.append(('F2', 8, 36, y, esc(f"{s_title} [{s_pts} pts]")))
                y -= 11
                s_desc = s.get('content') or s.get('details') or ''
                if s_desc:
                    lines.append(('F1', 7.5, 46, y, esc(f"Spec: {s_desc[:95]}")))
                    y -= 11

    # 3. Examples
    if parsed.get('examples') and y > 80:
        y -= 6
        lines.append(('F2', 9.5, 36, y, '3. Concrete Examples:'))
        y -= 13
        for ex in parsed['examples'][:2]:
            if y > 80:
                lines.append(('F2', 8, 36, y, esc(f"Example {ex.get('example_num', 1)}:")))
                y -= 11
                if ex.get('input'):
                    lines.append(('F1', 7.5, 46, y, esc(f"Input: {ex['input'].replace(chr(10), '; ')[:90]}")))
                    y -= 11
                if ex.get('output'):
                    lines.append(('F1', 7.5, 46, y, esc(f"Output: {ex['output'][:90]}")))
                    y -= 11

    # 4. Constraints
    if parsed.get('constraints') and y > 80:
        y -= 6
        lines.append(('F2', 9.5, 36, y, '4. Constraints:'))
        y -= 12
        for c in parsed['constraints'][:4]:
            if y > 80:
                lines.append(('F1', 7.5, 46, y, esc(f"- {c[:95]}")))
                y -= 11

    # 5. Rubric
    if parsed.get('rubric') and y > 80:
        y -= 6
        lines.append(('F2', 9.5, 36, y, '5. Grading Rubric:'))
        y -= 12
        for r in parsed['rubric'][:3]:
            if y > 80:
                lines.append(('F1', 7.5, 46, y, esc(f"- {r.get('criterion', '')} ({r.get('points', 30)} pts): {r.get('description', '')[:70]}")))
                y -= 11

    if y > 60:
        y -= 8
        lines.append(('F2', 8.5, 36, y, 'Submission & AI Assessment Notice:'))
        y -= 11
        lines.append(('F1', 7.5, 36, y, 'Submit via NexusEdu AI student dashboard. Submissions are graded by Gemini AI pipeline.'))

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
        except Exception as e:
            print("ReportLab generation warning:", e)
            return _generate_pure_pdf_bytes(assignment)
    return _generate_pure_pdf_bytes(assignment)
