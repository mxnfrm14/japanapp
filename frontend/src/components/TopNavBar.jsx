import SearchField from './SearchField'

export default function TopNavBar({ isExpanded = true }) {
  return (
    <div
      className={`fixed top-0 right-0 z-50 hidden bg-transparent backdrop-blur-sm transition-all duration-300 ease-in-out md:block md:left-[104px] [mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_80%,transparent_100%)] ${isExpanded ? 'lg:left-[280px]' : 'lg:left-[104px]'}`}
    >
      <div className="mx-auto flex max-w-7xl justify-center px-8 py-4 lg:px-12">
        <SearchField className="w-full max-w-[640px]" shortcut />
      </div>
    </div>
  )
}
