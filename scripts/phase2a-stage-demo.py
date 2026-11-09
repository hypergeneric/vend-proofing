#!/usr/bin/env python3
"""Copy the historical demo into a disposable, integration-disabled fixture."""

from pathlib import Path
import re
import shutil
import sys


def replace_element(xml: str, name: str, value: str) -> str:
    pattern = re.compile(rf"(<{name}\b[^>]*>).*?(</{name}>)", re.DOTALL)
    return pattern.sub(lambda match: match[1] + value + match[2], xml)


def ignore_private(directory: str, names: list[str]) -> set[str]:
    omitted = set()
    for name in names:
        if name == "orders" and Path(directory).name == "storage":
            omitted.add(name)
        elif name in {"set.session.table", "set.messages.table", "set.mailinglist.table"}:
            omitted.add(name)
        elif re.fullmatch(r"set\.[0-9a-f]{32}\.table", name):
            omitted.add(name)
        elif name.endswith(".log"):
            omitted.add(name)
    return omitted


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: phase2a-stage-demo.py SOURCE_DATA NEW_FIXTURE_DIRECTORY")
    source = Path(sys.argv[1]).resolve()
    target = Path(sys.argv[2]).resolve()
    if target.exists():
        raise SystemExit(f"refusing to overwrite {target}")
    if not (source / "storage" / "set.page.table").is_file():
        raise SystemExit("source is not a Vend data directory")

    target.mkdir(parents=True)
    shutil.copytree(source / "storage", target / "storage", ignore=ignore_private)
    if (source / "uploads").is_dir():
        shutil.copytree(source / "uploads", target / "uploads")

    for path in (target / "storage").rglob("*.xml"):
        original = path.read_text(encoding="utf-8")
        xml = original
        for name in (
            "password", "set_contact_list", "contact_form_recipients",
            "sendgrid_api_key", "smtp_hostname", "smtp_username", "smtp_password",
            "mailing_list_account_api_key", "mailing_list_subscriber_list_key",
            "paypal_email_address", "stripe_api_key", "dropbox_api_key",
            "dropbox_api_secret", "dropbox_authorization_code", "dropbox_token",
        ):
            xml = replace_element(xml, name, "")
        if path.name == "contact.xml":
            xml = replace_element(xml, "mail_provider", "none")
            xml = replace_element(xml, "your_email", "Test Owner")
            xml = re.sub(r'(<your_email\b[^>]*\bhref=")[^"]*', r'\1test@example.com', xml)
        if path.name == "ordering.xml":
            for name in ("merchant_gateway", "mailing_list"):
                xml = replace_element(xml, name, "none")
            for name in ("allow_offsite_paypal_payments_bool", "enable_paypal_merchant_account_bool"):
                xml = replace_element(xml, name, "false")
        if path.name == "cron.xml":
            xml = replace_element(xml, "cron_enabled_bool", "false")
            xml = replace_element(xml, "dropbox_purge_old_bool", "false")
        if xml != original:
            path.write_text(xml, encoding="utf-8")

    pages = (target / "storage" / "set.page.table").read_text().splitlines()
    print(f"Staged {len(pages)} gallery records at {target}")
    print("Excluded orders, proofing sessions, message logs, and mailing lists.")
    print("Disabled mail, payment credentials, Dropbox credentials, and cron jobs.")


if __name__ == "__main__":
    main()
