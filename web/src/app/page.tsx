import TranscriptForm from "@/components/TranscriptForm";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-red-600/20 blur-[120px]" />
        <div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-rose-900/20 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-10 text-center sm:mb-12">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-zinc-400 uppercase">
            Webshare Proxy
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            유튜브 자막 추출
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            YouTube 링크를 입력하면 자동·수동 자막을 추출합니다.
            IP 차단 우회를 위해 프록시를 통해 요청합니다.
          </p>
        </header>

        <TranscriptForm />
      </div>
    </main>
  );
}
