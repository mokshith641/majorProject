import logging
import os
from datetime import datetime
from typing import Dict, List, Any

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
)

logger = logging.getLogger(__name__)


def generate_meeting_pdf(
    meeting_title: str,
    meeting_date: datetime,
    duration_seconds: int,
    summary_data: Dict[str, Any],
    engagement_metrics: Dict[str, Any],
    output_path: str,
) -> bool:
    """
    Compile report data into a professionally styled PDF document.
    """
    try:
        # Ensure folders exist
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            rightMargin=54,
            leftMargin=54,
            topMargin=54,
            bottomMargin=54,
        )
        
        styles = getSampleStyleSheet()
        
        # Define modern color palette
        c_primary = colors.HexColor("#4F46E5")  # Indigo
        c_secondary = colors.HexColor("#0F172A")  # Dark slate text
        c_light_bg = colors.HexColor("#F8FAFC")  # Cool light grey
        c_border = colors.HexColor("#E2E8F0")  # Border light
        c_success = colors.HexColor("#10B981")  # Green
        
        # Define custom typography styles
        style_title = ParagraphStyle(
            name="ReportTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            textColor=c_primary,
            alignment=0,  # Left align
            spaceAfter=15
        )
        
        style_h1 = ParagraphStyle(
            name="ReportH1",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            textColor=c_secondary,
            spaceBefore=15,
            spaceAfter=10,
            keepWithNext=True
        )
        
        style_body = ParagraphStyle(
            name="ReportBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#334155"),
            leading=14,
            spaceAfter=8
        )
        
        style_th = ParagraphStyle(
            name="TableHead",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            textColor=colors.white
        )
        
        style_td = ParagraphStyle(
            name="TableData",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=c_secondary,
            leading=12
        )

        story = []
        
        # 1. Title Block
        story.append(Paragraph(meeting_title, style_title))
        date_str = meeting_date.strftime("%B %d, %Y - %I:%M %p")
        story.append(Paragraph(f"<b>Date:</b> {date_str}", style_body))
        
        # Duration formatter
        minutes = duration_seconds // 60
        seconds = duration_seconds % 60
        duration_str = f"{minutes}m {seconds}s" if minutes > 0 else f"{seconds}s"
        story.append(Paragraph(f"<b>Meeting Duration:</b> {duration_str}", style_body))
        story.append(Spacer(1, 15))
        
        # 2. Key Metrics Callout Block (Table grid)
        focus_pct = engagement_metrics.get("focus_score", 0.0)
        idle_pct = engagement_metrics.get("idle_percent", 0.0)
        active_pct = 100.0 - idle_pct
        
        metrics_data = [
            [
                Paragraph("<b>Average Focus</b>", style_td),
                Paragraph("<b>Active Interaction</b>", style_td),
                Paragraph("<b>Idle Status</b>", style_td)
            ],
            [
                Paragraph(f"<font color='{c_primary.hexval()}'>{focus_pct:.1f}%</font>", style_title),
                Paragraph(f"<font color='{c_success.hexval()}'>{active_pct:.1f}%</font>", style_title),
                Paragraph(f"<font color='#EF4444'>{idle_pct:.1f}%</font>", style_title)
            ]
        ]
        
        metrics_table = Table(metrics_data, colWidths=[168, 168, 168])
        metrics_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), c_light_bg),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 10),
            ('LINEBELOW', (0, 0), (-1, 0), 1, c_border),
            ('BOX', (0, 0), (-1, -1), 1, c_border),
        ]))
        
        story.append(metrics_table)
        story.append(Spacer(1, 20))
        
        # 3. AI Summary Section
        story.append(Paragraph("Executive Summary", style_h1))
        key_points = summary_data.get("key_points", "No key points generated.")
        story.append(Paragraph(key_points.replace("\n", "<br/>"), style_body))
        
        story.append(Paragraph("Core Decisions", style_h1))
        decisions = summary_data.get("decisions", "No decisions logged.")
        story.append(Paragraph(decisions.replace("\n", "<br/>"), style_body))

        if summary_data.get("risks"):
            story.append(Paragraph("Identified Risks & Roadblocks", style_h1))
            risks = summary_data["risks"]
            story.append(Paragraph(risks.replace("\n", "<br/>"), style_body))
            
        story.append(Spacer(1, 15))
        
        # 4. Action Items Section
        action_items: List[Dict] = summary_data.get("action_items", [])
        if action_items:
            story.append(Paragraph("Action Items", style_h1))
            
            # Action item grid structure
            # Columns: Task, Assignee, Due Date, Status
            action_table_data = [[
                Paragraph("Task Description", style_th),
                Paragraph("Assignee", style_th),
                Paragraph("Due Date", style_th),
                Paragraph("Status", style_th)
            ]]
            
            for item in action_items:
                action_table_data.append([
                    Paragraph(item.get("task", "TBD"), style_td),
                    Paragraph(item.get("assignee", "Unassigned"), style_td),
                    Paragraph(item.get("due_date", "TBD"), style_td),
                    Paragraph(item.get("status", "pending").upper(), style_td)
                ])
                
            action_table = Table(action_table_data, colWidths=[200, 100, 100, 104])
            action_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), c_primary),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('PADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, c_border),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_light_bg])
            ]))
            
            story.append(KeepTogether([action_table]))
            
        # Build PDF
        doc.build(story)
        logger.info(f"Report PDF created successfully at: {output_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to generate report PDF: {e}", exc_info=True)
        return False
