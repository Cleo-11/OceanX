interface WalletInfoProps {
  balance: number
}

export function WalletInfo({ balance }: WalletInfoProps) {
  return (
    <div className="absolute right-4 top-4 z-20 rounded-lg bg-slate-900/70 px-4 py-2 backdrop-blur-md">
      <div className="flex items-center">
        <div className="mr-2 h-3 w-3 rounded-full bg-green-500" />
        <span className="text-sm text-slate-300">Wallet Connected</span>
      </div>
      <div className="font-mono text-lg font-bold text-cyan-400">{balance.toLocaleString()} OCE</div>
    </div>
  )
}
