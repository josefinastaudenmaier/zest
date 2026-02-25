import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="mb-2 text-xl font-bold text-gray-900">
        Página no encontrada
      </h1>
      <p className="mb-6 text-gray-600">
        La ruta que buscás no existe.
      </p>
      <Link
        href="/"
        className="font-manrope rounded-xl bg-primary-500 px-4 py-2 font-medium leading-normal text-white tracking-[-0.72px] hover:bg-primary-600"
      >
        Ir al inicio
      </Link>
    </div>
  );
}
