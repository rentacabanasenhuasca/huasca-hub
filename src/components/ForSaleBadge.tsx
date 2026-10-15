// Letrerito de "Se vende" en forma de casita que se pone encima de la foto
// de portada cuando la propiedad tiene activado `for_sale` en el admin.
// Es pequeño y va en una esquina para no tapar la foto. El contenedor padre
// debe tener `position: relative`; el tamaño y la posición llegan en className
// (por ejemplo "top-3 left-3 w-14").
export default function ForSaleBadge({ className = '' }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Propiedad en venta"
      title="Esta propiedad está en venta"
      className={`pointer-events-none absolute z-10 block -rotate-6 drop-shadow-[0_3px_6px_rgba(0,0,0,0.35)] ${className}`}
    >
      <svg viewBox="0 0 100 104" className="block h-auto w-full" aria-hidden>
        <path
          d="M50 6 L95 46 H85 V98 H15 V46 H5 Z"
          fill="#ffffff"
          stroke="#b91c1c"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <circle cx="50" cy="28" r="4.5" fill="none" stroke="#b91c1c" strokeWidth="3" />
        <text
          x="50"
          y="64"
          textAnchor="middle"
          fontFamily="'Arial Black', Arial, Helvetica, sans-serif"
          fontWeight={900}
          fontSize="19"
          fill="#b91c1c"
        >
          SE
        </text>
        <text
          x="50"
          y="86"
          textAnchor="middle"
          fontFamily="'Arial Black', Arial, Helvetica, sans-serif"
          fontWeight={900}
          fontSize="17"
          fill="#b91c1c"
        >
          VENDE
        </text>
      </svg>
    </span>
  )
}
