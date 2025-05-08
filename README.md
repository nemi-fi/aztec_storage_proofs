# Aztec Storage Proofs

Prove Aztec note inclusion in plain Noir. Generate verifiable proofs for verification in JS or Solidity.

Supports exactly Aztec 0.85.0-alpha-testnet.9

Install in JS:

```sh
npm add @nemi-fi/aztec-storage-proofs -E
```

Install in Noir (Nargo.toml):

```toml
[dependencies]
storage_proofs = { git = "https://github.com/nemi-fi/aztec_storage_proofs", tag = "v0.1.0", directory = "lib" }
```

For an end to end example, see [lib.test.ts](lib.test.ts).
