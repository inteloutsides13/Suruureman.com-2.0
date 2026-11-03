# Contributor System

The contributor system spans public application, admin review, email activation,
status lookup, and an authenticated contributor portal.

## Public flow

1. Applicant submits name, email, optional DOB/contact/portfolio, bio, contribution
   area, preferred language, category, and terms acceptance.
2. The server records `contributor-terms-v1` and acceptance time.
3. The application begins in `pending`.
4. Admin/developer review can approve or reject with a reason.
5. Approval provisions or links a contributor account and prepares activation.
6. The email contains a 72-hour, single-use activation link.
7. The contributor sets a password and enters the portal.

## Portal flow

Active contributors can view their account/submissions and create or edit their
own poems, poets, and radio submissions. Server-side ownership and role checks
remain authoritative. Publishing and approval are not granted merely because a
record was submitted.

## Data protection

Contributor applications contain personal data. They are not part of the safe
repository backup. Activation token hashes/ciphertexts, account credentials,
sessions, and audit data must be preserved only through controlled database
backup procedures.