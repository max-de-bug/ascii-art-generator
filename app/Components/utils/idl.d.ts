// Type declaration for IDL JSON imports
// This file helps TypeScript understand JSON imports from the smartcontracts directory

declare module "@/app/Components/smartcontracts/ascii/target/idl/ascii.json" {
  import { Idl } from "@coral-xyz/anchor";
  const idl: Idl;
  export default idl;
}

declare module "../smartcontracts/ascii/target/idl/ascii.json" {
  import { Idl } from "@coral-xyz/anchor";
  const idl: Idl;
  export default idl;
}

// Also declare for the exact path used in the import
declare module "*/Components/smartcontracts/ascii/target/idl/ascii.json" {
  import { Idl } from "@coral-xyz/anchor";
  const idl: Idl;
  export default idl;
}

