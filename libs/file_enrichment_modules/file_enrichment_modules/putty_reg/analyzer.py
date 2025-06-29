# enrichment_modules/putty_reg/analyzer.py
import re
import tempfile
import textwrap
from pathlib import Path

import structlog
import yara_x
from common.models import EnrichmentResult, FileObject, Finding, FindingCategory, FindingOrigin, Transform
from common.state_helpers import get_file_enriched
from common.storage import StorageMinio

from file_enrichment_modules.module_loader import EnrichmentModule

logger = structlog.get_logger(module=__name__)

# Port of https://github.com/NetSPI/PowerHuntShares/blob/46238ba37dc85f65f2c1d7960f551ea3d80c236a/Scripts/ConfigParsers/parser-putty.reg.ps1
#   Original Author: Scott Sutherland, NetSPI (@_nullbind / nullbind)
#   License: BSD 3-clause


class PuttyParser(EnrichmentModule):
    def __init__(self):
        super().__init__("putty_parser")
        self.storage = StorageMinio()
        # the workflows this module should automatically run in
        self.workflows = ["default"]

        # Yara rule to check for Putty registry content
        self.yara_rule = yara_x.compile("""
rule has_putty_reg
{
    strings:
        $putty_header = "HKEY_CURRENT_USER\\\\Software\\\\SimonTatham\\\\PuTTY" nocase
    condition:
        $putty_header
}
        """)

    def should_process(self, object_id: str) -> bool:
        """Determine if this module should run based on file type."""
        file_enriched = get_file_enriched(object_id)

        # First check if it's a plaintext .reg file
        if not (file_enriched.is_plaintext and file_enriched.file_name.lower().endswith(".reg")):
            return False

        # Check for Putty registry content using Yara
        file_bytes = self.storage.download_bytes(file_enriched.object_id)
        should_run = len(self.yara_rule.scan(file_bytes).matching_rules) > 0

        logger.debug(f"PuttyParser should_run: {should_run}")
        return should_run

    def _parse_putty_reg(self, content: str) -> list[dict]:
        """Parse the Putty registry file content."""
        sessions = []
        current_session = None
        current_data = {}

        for line in content.splitlines():
            line = line.strip()

            # Skip empty lines and comments
            if not line or line.startswith(";"):
                continue

            # Check for session headers
            if line.startswith("["):
                # Save previous session if exists
                if current_session and current_data:
                    sessions.append({"session_name": current_session, **current_data})

                # Start new session
                match = re.search(r"Sessions\\(.+?)\]", line)
                if match:
                    current_session = match.group(1)
                    current_data = {}
                continue

            # Parse key-value pairs
            if "=" in line:
                key, value = line.split("=", 1)
                key = key.strip('"')

                # Handle different value types
                if value.startswith("dword:"):
                    value = int(value[7:], 16)
                else:
                    value = value.strip('"')

                current_data[key] = value

        # Add final session
        if current_session and current_data:
            sessions.append({"session_name": current_session, **current_data})

        return sessions

    def _create_finding_summary(self, sessions: list[dict]) -> str:
        """Creates a markdown summary for the Putty sessions."""
        summary = "# Putty Sessions Found\n\n"

        for session in sessions:
            if "HostName" not in session:
                continue

            summary += f"## Session: {session['session_name']}\n"
            summary += f"* **Hostname**: {session.get('HostName', 'N/A')}\n"
            summary += f"* **Port**: {session.get('PortNumber', 22)}\n"
            summary += f"* **Username**: {session.get('UserName', 'N/A')}\n"
            if "PublicKeyFile" in session:
                summary += f"* **Key File**: {session['PublicKeyFile']}\n"
            summary += "\n"

        return summary

    def process(self, object_id: str) -> EnrichmentResult | None:
        """Process Putty registry file."""
        try:
            file_enriched = get_file_enriched(object_id)
            enrichment_result = EnrichmentResult(module_name=self.name, dependencies=self.dependencies)

            # Download and read the file
            with self.storage.download(file_enriched.object_id) as temp_file:
                content = Path(temp_file.name).read_text(encoding="utf-8")

                # Parse the registry content
                sessions = self._parse_putty_reg(content)

                if sessions:
                    # Create finding summary
                    summary_markdown = self._create_finding_summary(sessions)

                    # Create display data
                    display_data = FileObject(type="finding_summary", metadata={"summary": summary_markdown})

                    # Create finding
                    finding = Finding(
                        category=FindingCategory.CREDENTIAL,
                        finding_name="putty_sessions_detected",
                        origin_type=FindingOrigin.ENRICHMENT_MODULE,
                        origin_name=self.name,
                        object_id=file_enriched.object_id,
                        severity=5,
                        raw_data={"sessions": sessions},
                        data=[display_data],
                    )

                    # Add finding to enrichment result
                    enrichment_result.findings = [finding]
                    enrichment_result.results = {"sessions": sessions}

                    # Create a displayable version of the results
                    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8") as tmp_display_file:
                        yaml_output = []
                        yaml_output.append("Putty Registry Analysis")
                        yaml_output.append("=====================\n")

                        for session in sessions:
                            yaml_output.append(f"Session: {session['session_name']}")
                            for key, value in session.items():
                                if key != "session_name":
                                    yaml_output.append(f"   {key}: {value}")
                            yaml_output.append("")

                        display = textwrap.indent("\n".join(yaml_output), "   ")
                        tmp_display_file.write(display)
                        tmp_display_file.flush()

                        object_id = self.storage.upload_file(tmp_display_file.name)

                        displayable_parsed = Transform(
                            type="displayable_parsed",
                            object_id=f"{object_id}",
                            metadata={
                                "file_name": f"{file_enriched.file_name}_analysis.txt",
                                "display_type_in_dashboard": "monaco",
                                "default_display": True,
                            },
                        )
                    enrichment_result.transforms = [displayable_parsed]

                return enrichment_result

        except Exception as e:
            logger.exception(e, message="Error processing Putty registry file")
            return None


def create_enrichment_module() -> EnrichmentModule:
    return PuttyParser()
