# Aztec Storage Proofs

Prove Aztec note inclusion in plain Noir. Generate verifiable proofs for verification in JS or Solidity.

**Supports exactly Aztec 2.0.3**

Install in JS:

```sh
npm add @nemi-fi/aztec-storage-proofs@2.0.3
```

Install in Noir (Nargo.toml):

```toml
[dependencies]
storage_proofs = { git = "https://github.com/nemi-fi/aztec_storage_proofs", tag = "v3.0.0-devnet.2", directory = "lib" }
```

For an end to end example, see [lib.test.ts](lib.test.ts).
