"use client";
import { useId, useRef, useState, useTransition } from "react";
import { FormMessage } from "@/components/forms/FormBits";
import { idle, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/client";
import { DOC_TYPES, IMAGE_TYPES, MAX_DOC_BYTES, MAX_IMAGE_BYTES, safeFileName } from "@/lib/upload";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Sube un archivo al almacenamiento con la sesión del usuario (las políticas del bucket validan permisos)
 * y luego registra los datos con la acción de servidor. El formulario recibe storage_path, file_name,
 * mime_type y size_bytes además de los campos propios.
 */
export function UploadForm({
  action, bucket, prefix, children, submit = "Subir", kind = "doc", required = true, fileLabel = "Archivo",
}: {
  action: Action;
  bucket: "private-docs" | "public-assets";
  prefix: string;
  children?: React.ReactNode;
  submit?: string;
  kind?: "doc" | "image";
  required?: boolean;
  fileLabel?: string;
}) {
  const [state, setState] = useState<ActionState>(idle);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const fid = useId();
  const types = kind === "image" ? IMAGE_TYPES : DOC_TYPES;
  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_DOC_BYTES;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    fd.delete("file");
    if (file instanceof File && file.size > 0) {
      if (!types.includes(file.type)) return setState({ status: "error", message: "Formato no permitido." });
      if (file.size > max) return setState({ status: "error", message: `El archivo supera ${Math.round(max / 1048576)} MB.` });
      setUploading(true);
      const path = `${prefix.replace(/\/$/, "")}/${safeFileName(file.name)}`;
      const { error } = await createClient().storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
      setUploading(false);
      if (error) return setState({ status: "error", message: "No se pudo subir el archivo. Verifique su sesión y permisos." });
      fd.set("storage_path", path);
      fd.set("file_name", file.name.slice(0, 200));
      fd.set("mime_type", file.type);
      fd.set("size_bytes", String(file.size));
    } else if (required) {
      return setState({ status: "error", message: "Seleccione un archivo." });
    }
    start(async () => {
      const r = await action(idle, fd);
      setState(r);
      if (r.status === "ok") ref.current?.reset();
    });
  }

  const busy = pending || uploading;
  return (
    <form ref={ref} className="form" onSubmit={onSubmit}>
      {children}
      <div className="field">
        <label htmlFor={fid} className={required ? "required" : undefined}>{fileLabel}</label>
        <input id={fid} className="input" type="file" name="file" accept={types.join(",")} required={required} />
        <span className="hint">{kind === "image" ? "JPG, PNG o WebP" : "PDF, JPG, PNG o WebP"} · máx. {Math.round(max / 1048576)} MB</span>
      </div>
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>
          {uploading ? "Subiendo…" : pending ? "Guardando…" : submit}
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
