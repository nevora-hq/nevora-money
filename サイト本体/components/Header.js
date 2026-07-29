import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function Header({ categories = [] }) {
  const [open, setOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const router = useRouter();

  const close = () => {
    setOpen(false);
    setCategoryOpen(false);
  };

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="logo" onClick={close}>
          美容の総合ガイド｜NEVORA
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-label="メニューを開く"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="nav-toggle-bar" />
        </button>
        <nav className={`main-nav${open ? " open" : ""}`}>
          <Link href="/" className="main-nav-link" onClick={close} aria-current={router.pathname === "/" ? "page" : undefined}>
            トップ
          </Link>
          {categories.length > 0 && (
            <div className={`nav-dropdown${categoryOpen ? " open" : ""}`}>
              <button
                type="button"
                className="nav-dropdown-label"
                aria-expanded={categoryOpen}
                onClick={() => setCategoryOpen((v) => !v)}
              >
                カテゴリ
                <span className="nav-dropdown-arrow" aria-hidden="true" />
              </button>
              <div className="nav-dropdown-menu">
                {categories.map((c) => (
                  <Link key={c.name} href={`/category/${encodeURIComponent(c.name)}`} onClick={close}>
                    {c.name}
                    <span className="nav-dropdown-count">{c.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          <Link href="/ranking" className="main-nav-link" onClick={close}>
            ランキング
          </Link>
          <Link href="/compare" className="main-nav-link" onClick={close}>
            比較
          </Link>
          <Link href="/search" className="main-nav-link" onClick={close}>
            検索
          </Link>
        </nav>
      </div>
    </header>
  );
}
