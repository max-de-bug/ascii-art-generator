import { PublicKey } from "@solana/web3.js"


 export const WalletAddressCard = ( { publicKey }: { publicKey: PublicKey | null } ) => {
    return (

        <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground mb-2">
          Wallet Address
        </p>
        <p className="font-mono text-sm break-all">
          {publicKey?.toString()}
        </p>
      </div>

    )
}