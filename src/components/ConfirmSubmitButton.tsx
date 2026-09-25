'use client'

import type { ButtonHTMLAttributes } from 'react'

// Botón de submit que pide confirmación (confirm() nativo del navegador)
// antes de dejar que el formulario se envíe. Úsalo para acciones que
// borran o quitan algo (eliminar propiedad, eliminar regla, quitar una
// aplicación de regla…) para evitar clics accidentales.
export default function ConfirmSubmitButton({
  confirmMessage,
  children,
  ...rest
}: { confirmMessage: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      type="submit"
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault()
        }
      }}
    >
      {children}
    </button>
  )
}
