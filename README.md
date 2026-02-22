# Agent Identity Core

The `AgentIdentityCore` module provides a robust, cryptographically verifiable identity system for autonomous agents. It integrates deeply with corporate identity systems by embedding ownership, organizational affiliation, and authority scopes directly into the agent's identity.

## Features

- **Cryptographic Sovereignty**: Every agent is assigned a unique identity signed with RSA-256 signatures.
- **Rich Metadata**: Identities include:
  - **Ownership**: Tracks which user or system owns the agent.
  - **Organizational Affiliation**: Links agents to specific corporate entities.
  - **Authority Scope**: Defines what resources and actions the agent is authorized to perform.
  - **Operational Context**: Contextual data like environment (production/staging) and region.
- **Lifecycle Management**:
  - **Portability**: Identities are portable JSON structures that can be verified by any system with the public key.
  - **Key Rotation**: Supports versioned identity updates with new cryptographic keys.
  - **Expiration**: Built-in expiration rules for temporary authority.
  - **Revocation**: Centralized revocation mechanism to immediately invalidate compromised or decommissioned agents.

## Usage

```typescript
import { AgentIdentityCore } from './src/AgentIdentityCore';

const core = new AgentIdentityCore();

// Create identity
const { identity, keyPair } = core.createIdentity({
  ownerId: 'user_1',
  orgId: 'acme_corp',
  scope: { resources: ['*'], actions: ['read'] },
  context: { environment: 'production' }
});

// Verify identity
const result = core.verifyIdentity(identity);
if (result.valid) {
  console.log('Identity is valid!');
}
```

## Security

All identities are signed using RSA (256-bit). Private keys should be stored securely and never shared. The `AgentIdentityPayload` contains the public key used for its own verification, allowing for a self-contained (but verifiable) identity token.
