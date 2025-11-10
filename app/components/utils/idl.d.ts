/**
 * Type declaration for Anchor IDL JSON file
 * This file will be generated after running `anchor build`
 *
 * This declaration tells TypeScript that the IDL module exists,
 * even if the actual file hasn't been generated yet.
 */

declare module "*/target/idl/ascii.json" {
  import { Idl } from "@coral-xyz/anchor";
  const idl: Idl;
  export default idl;
}

// Also declare the specific path used in the import
declare module "../../components/smartcontracts/ascii/target/idl/ascii.json" {
  import { Idl } from "@coral-xyz/anchor";
  const idl: Idl;
  export default idl;
}
