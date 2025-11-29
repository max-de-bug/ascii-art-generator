// Type declaration for IDL JSON imports
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

