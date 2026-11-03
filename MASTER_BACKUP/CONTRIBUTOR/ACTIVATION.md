# Activation

- Approved applications receive a generated activation capability.
- The database stores a hash and encrypted ciphertext, not a reusable plaintext
  credential.
- Activation links expire after 72 hours and become invalid after use.
- Reissue invalidates/replaces the prior activation state and sends a new link.
- Activation and login remain separate from Replit or GitHub authentication.
- A clone needs a valid `JWT_SECRET`, database, public URL, and SMTP configuration
  to reproduce the flow.