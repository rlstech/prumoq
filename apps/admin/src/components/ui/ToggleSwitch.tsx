interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Chave: ligada em grafite com o botão amarelo; desligada no tom de junta. */
export default function ToggleSwitch({ checked, onChange, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out ${
        checked ? 'bg-sidebar' : 'bg-brd-1'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      disabled={disabled}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-[3px] inline-block h-[18px] w-[18px] rounded-full transition duration-200 ease-in-out ${
          checked ? 'translate-x-5 bg-accent' : 'translate-x-0 bg-white'
        }`}
      />
    </button>
  );
}
