import React, { useEffect, useMemo, useState } from 'react';
import { Github, Search, Star, GitFork, MapPin, Users, ExternalLink, Code2, ArrowLeft, ArrowRight, Sun, Moon, Bookmark, BarChart3, GitCompareArrows, RefreshCw, X, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import './style.css';

const GITHUB = 'https://api.github.com';
const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const colors = ['#8e9bff', '#34d399', '#f59e0b', '#fb7185', '#38bdf8', '#c084fc', '#f472b6', '#a3e635'];
const format = n => new Intl.NumberFormat('es-DO').format(n ?? 0);

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    if (response.status === 404) throw new Error('No encontramos el usuario o recurso solicitado.');
    if (response.status === 403 || response.status === 429) throw new Error('Límite de consultas de GitHub alcanzado. Espera e inténtalo más tarde.');
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Error HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}
const github = (path, signal) => request(GITHUB + path, { headers: { Accept: 'application/vnd.github+json' }, signal });

function analyze(repos) {
  const languages = {};
  let stars = 0, forks = 0;
  repos.forEach(r => {
    const language = r.language || 'Sin especificar';
    languages[language] = (languages[language] || 0) + 1;
    stars += r.stargazers_count || 0;
    forks += r.forks_count || 0;
  });
  const distribution = Object.entries(languages).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return { distribution, stars, forks, total: repos.length, main: distribution[0]?.name || 'N/D' };
}
function Metric({ label, value, subtitle }) { return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{subtitle}</small></div>; }

export default function App() {
  const [input, setInput] = useState('');
  const [username, setUsername] = useState('');
  const [user, setUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dark, setDark] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [dbError, setDbError] = useState('');
  const [toast, setToast] = useState(null);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [savingRepo, setSavingRepo] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('stars');
  const [page, setPage] = useState(1);
  const [compareInput, setCompareInput] = useState('');
  const [comparison, setComparison] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');

  // Avisos de confirmación locales: se eliminan automáticamente a los 3 segundos.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!collectionOpen) return;
    const closeOnEscape = event => { if (event.key === 'Escape') setCollectionOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [collectionOpen]);

  const notify = (type, id, message) => setToast({ type, id, message, token: Date.now() });

  async function reloadSaved() {
    try {
      const [fav, prof] = await Promise.all([request(BACKEND + '/favorites'), request(BACKEND + '/profiles')]);
      setFavorites(fav); setProfiles(prof); setDbError('');
    } catch (e) { setDbError(e.message + '. Comprueba PostgreSQL, el esquema y el backend en el puerto 4000.'); }
  }
  useEffect(() => { reloadSaved(); }, []);
  useEffect(() => {
    if (!username.trim()) return;
    setComparison(null);
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.all([
      github('/users/' + encodeURIComponent(username), controller.signal),
      github('/users/' + encodeURIComponent(username) + '/repos?per_page=100&sort=updated&type=owner', controller.signal)
    ]).then(([profile, list]) => { setUser(profile); setRepos(list); setPage(1); setQuery(''); })
      .catch(e => { if (e.name !== 'AbortError') { setError(e.message); setUser(null); setRepos([]); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [username]);

  const stats = useMemo(() => analyze(repos), [repos]);
  const filtered = useMemo(() => repos.filter(r => r.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'stars' ? b.stargazers_count - a.stargazers_count : new Date(b.updated_at) - new Date(a.updated_at)), [repos, query, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 6));
  const current = filtered.slice((page - 1) * 6, page * 6);
  const isFavorite = id => favorites.some(f => Number(f.github_id) === id);
  const isProfileSaved = user && profiles.some(p => Number(p.github_id) === user.id);

  async function toggleFavorite(repo) {
    if (savingRepo !== null) return;
    setSavingRepo(repo.id);
    try {
      const exists = isFavorite(repo.id);
      await request(BACKEND + '/favorites' + (exists ? '/' + repo.id : ''), {
        method: exists ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' },
        ...(!exists && { body: JSON.stringify({ github_id: repo.id, full_name: repo.full_name, html_url: repo.html_url, description: repo.description, language: repo.language, stars: repo.stargazers_count }) })
      });
      await reloadSaved(); notify('repo', repo.id, exists ? 'Repositorio eliminado exitosamente' : 'Repositorio guardado exitosamente');
    } catch (e) { setDbError(e.message); }
    finally { setSavingRepo(null); }
  }
  async function toggleProfile() {
    if (!user || savingProfile) return;
    setSavingProfile(true);
    try {
      await request(BACKEND + '/profiles' + (isProfileSaved ? '/' + user.id : ''), {
        method: isProfileSaved ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' },
        ...(!isProfileSaved && { body: JSON.stringify({ github_id: user.id, login: user.login, name: user.name, avatar_url: user.avatar_url, html_url: user.html_url, followers: user.followers, public_repos: user.public_repos }) })
      });
      await reloadSaved(); notify('profile', user.id, isProfileSaved ? 'Perfil eliminado exitosamente' : 'Perfil guardado exitosamente');
    } catch (e) { setDbError(e.message); }
    finally { setSavingProfile(false); }
  }
  async function compare(event) {
    event.preventDefault(); if (!compareInput.trim()) return;
    setCompareLoading(true); setCompareError(''); setComparison(null);
    try {
      const login = compareInput.trim();
      const [profile, list] = await Promise.all([
        github('/users/' + encodeURIComponent(login)),
        github('/users/' + encodeURIComponent(login) + '/repos?per_page=100&sort=updated&type=owner')
      ]);
      setComparison({ profile, stats: analyze(list) });
    } catch (e) { setCompareError(e.message); }
    finally { setCompareLoading(false); }
  }
  const chart = stats.distribution.slice(0, 7);
  const compareData = comparison && user ? [
    { name: 'Repos públicos', actual: user.public_repos, otro: comparison.profile.public_repos },
    { name: 'Seguidores', actual: user.followers, otro: comparison.profile.followers },
    { name: 'Estrellas*', actual: stats.stars, otro: comparison.stats.stars }
  ] : [];

  return <div className={dark ? 'app dark' : 'app'}>
    <nav><div className="logo"><Github size={29}/> Dev<span>Insight</span></div><div className="nav-actions"><button className="collection-button" onClick={() => setCollectionOpen(true)}><Bookmark size={17}/> Ver colección <span className="collection-count">{profiles.length + favorites.length}</span></button><button className="theme" onClick={() => setDark(v => !v)} aria-label="Cambiar tema">{dark ? <Sun size={19}/> : <Moon size={19}/>}</button></div></nav>
    <main>
      <header className="hero"><div className="kicker"><BarChart3 size={15}/> ANÁLISIS DE DESARROLLADORES · API REST</div><h1>Explora el código.<br/><em>Entiende los datos.</em></h1><p>Analiza perfiles y repositorios públicos de GitHub, compara estadísticas y guarda tus favoritos en PostgreSQL.</p>
        <form className="find" onSubmit={e => { e.preventDefault(); if (input.trim()) setUsername(input.trim()); }}><Search size={20}/><input value={input} onChange={e => setInput(e.target.value)} aria-label="Usuario de GitHub" placeholder="Ejemplo: torvalds"/><button>Analizar <Search size={16}/></button></form>
        <div className="examples">Prueba: {['torvalds', 'gaearon', 'vercel', 'facebook'].map(u => <button key={u} onClick={() => { setInput(u); setUsername(u); }}>@{u}</button>)}</div>
      </header>
      {dbError && <div className="status error" role="alert">Base de datos: {dbError} <button className="secondary-btn" onClick={reloadSaved}><RefreshCw size={14}/> Reintentar</button></div>}
      {loading && <div className="status">Consultando la API de GitHub...</div>}
      {error && <div className="status error" role="alert">{error}</div>}
      {!loading && user && <>
        <section className="profile"><img src={user.avatar_url} alt={'Avatar de ' + user.login}/><div className="bio"><span className="label">PERFIL ANALIZADO</span><h2>{user.name || user.login} <a href={user.html_url} target="_blank" rel="noreferrer" aria-label="Abrir perfil en GitHub"><ExternalLink size={18}/></a></h2><p className="handle">@{user.login}</p><p>{user.bio || 'Sin biografía pública.'}</p><div className="meta">{user.location && <span><MapPin size={15}/>{user.location}</span>}<span><Users size={15}/>{format(user.followers)} seguidores</span></div></div><div className="profile-actions action-with-toast"><button className="primary-btn" onClick={toggleProfile} disabled={savingProfile} aria-pressed={Boolean(isProfileSaved)}><Bookmark size={16} color={isProfileSaved ? '#facc15' : 'currentColor'} fill={isProfileSaved ? '#facc15' : 'none'}/>{savingProfile ? 'Procesando...' : isProfileSaved ? 'Perfil guardado' : 'Guardar perfil'}</button>{toast?.type === 'profile' && toast.id === user.id && <div className="action-toast profile-toast" role="status"><CheckCircle2 size={16}/>{toast.message}</div>}</div></section>
        <section className="dashboard-section"><div className="section-heading"><span className="label">PANEL DE ESTADÍSTICAS</span><h2>Resumen de @{user.login}</h2></div>
          <div className="metrics"><Metric label="Repositorios públicos" value={format(user.public_repos)} subtitle="Total informado por GitHub"/><Metric label="Seguidores" value={format(user.followers)} subtitle="Perfil público"/><Metric label="Estrellas*" value={format(stats.stars)} subtitle="En repositorios analizados"/><Metric label="Lenguaje principal*" value={stats.main} subtitle="Por cantidad de repositorios"/></div>
          <div className="chart-grid"><div className="chart-card"><h3>Distribución de lenguajes*</h3><p>Conteo de repositorios según su lenguaje principal.</p><div className="chart-inner">{chart.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chart} dataKey="count" nameKey="name" innerRadius={65} outerRadius={100} paddingAngle={3}>{chart.map((x, i) => <Cell key={x.name} fill={colors[i % colors.length]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer> : <p>Sin datos de lenguajes.</p>}</div><div className="legend">{chart.map((x, i) => <span key={x.name}><i style={{ background: colors[i % colors.length] }}/>{x.name} ({x.count})</span>)}</div></div>
          <div className="chart-card"><h3>Repositorios más populares*</h3><p>Estrellas de los cinco repositorios analizados más destacados.</p><div className="chart-inner">{repos.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={[...repos].sort((a,b) => b.stargazers_count - a.stargazers_count).slice(0,5).map(r => ({ name: r.name.length > 13 ? r.name.slice(0,12) + '…' : r.name, stars: r.stargazers_count }))} layout="vertical" margin={{left:10,right:15}}><CartesianGrid strokeDasharray="3 3" stroke="#60718c" opacity={0.18}/><XAxis type="number" stroke="#8292aa" tick={{fontSize:11}}/><YAxis type="category" dataKey="name" width={104} stroke="#8292aa" tick={{fontSize:11}}/><Tooltip/><Bar dataKey="stars" fill="#8e9bff" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer> : <p>Sin repositorios.</p>}</div></div></div>
          <p className="data-note">* El análisis utiliza como máximo los 100 repositorios públicos más recientes del propietario que devuelve esta consulta a GitHub. No representa necesariamente todos sus repositorios ni los bytes de código por lenguaje. Las cifras pueden cambiar.</p>
        </section>
        <section className="dashboard-section"><div className="section-heading"><span className="label"><GitCompareArrows size={13}/> COMPARACIÓN</span><h2>Compara dos perfiles</h2><p>Introduce otro usuario para comparar sus métricas públicas.</p></div><form className="compare-form" onSubmit={compare}><input value={compareInput} onChange={e => setCompareInput(e.target.value)} aria-label="Segundo usuario de GitHub" placeholder="Ejemplo: gaearon"/><button className="primary-btn" disabled={compareLoading}>{compareLoading ? 'Consultando...' : 'Comparar perfiles'}</button></form>{compareError && <p className="error-text" role="alert">{compareError}</p>}{comparison && <><div className="comparison-labels"><span style={{color:'#8e9bff'}}>● @{user.login}</span><span style={{color:'#34d399'}}>● @{comparison.profile.login}</span></div><div className="compare-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={compareData}><CartesianGrid strokeDasharray="3 3" stroke="#60718c" opacity={0.2}/><XAxis dataKey="name" tick={{fontSize:11}} stroke="#8292aa"/><YAxis tick={{fontSize:11}} stroke="#8292aa"/><Tooltip/><Bar dataKey="actual" name={user.login} fill="#8e9bff" radius={[5,5,0,0]}/><Bar dataKey="otro" name={comparison.profile.login} fill="#34d399" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div><p className="data-note">* Las estrellas se calculan únicamente con los repositorios incluidos en la muestra de cada perfil.</p></>}</section>
        <section className="repo-section"><div className="section-title"><div><span className="label">EXPLORADOR</span><h2>Repositorios públicos</h2><p>Busca, filtra y guarda repositorios en tu base de datos.</p></div><div className="controls"><div className="repo-search"><Search size={16}/><input value={query} onChange={e => {setQuery(e.target.value);setPage(1);}} placeholder="Filtrar repositorios" aria-label="Filtrar repositorios"/></div><select value={sort} onChange={e => {setSort(e.target.value);setPage(1);}} aria-label="Ordenar repositorios"><option value="stars">Más estrellas</option><option value="updated">Más recientes</option></select></div></div><div className="repo-grid">{current.map(r => <article className="repo" key={r.id}><div className="repo-top"><Code2 size={20}/><a href={r.html_url} target="_blank" rel="noreferrer" aria-label={'Abrir ' + r.name}><ExternalLink size={16}/></a></div><h3>{r.name}</h3><p>{r.description || 'Repositorio sin descripción.'}</p><div className="repo-meta"><span className="language">{r.language || 'Sin lenguaje'}</span><span><Star size={14}/>{format(r.stargazers_count)}</span><span><GitFork size={14}/>{format(r.forks_count)}</span></div><button className="save-btn" onClick={() => toggleFavorite(r)} disabled={savingRepo !== null} aria-pressed={isFavorite(r.id)}><Bookmark size={16} color={isFavorite(r.id) ? '#facc15' : 'currentColor'} fill={isFavorite(r.id) ? '#facc15' : 'none'}/>{savingRepo === r.id ? 'Procesando...' : isFavorite(r.id) ? 'Guardado en favoritos' : 'Guardar favorito'}</button>{toast?.type === 'repo' && toast.id === r.id && <div className="action-toast repo-toast" role="status"><CheckCircle2 size={16}/>{toast.message}</div>}</article>)}</div>{!filtered.length && <div className="status">No hay repositorios que coincidan con el filtro.</div>}{pageCount > 1 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage(p => p - 1)}><ArrowLeft size={16}/> Anterior</button><span>Página {page} de {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage(p => p + 1)}>Siguiente <ArrowRight size={16}/></button></div>}</section>
      </>}
      
<footer>
  © 2026 DevInsight | Desarrollado por Joydelina Alvarez
  <p>React · Node.js · Express · PostgreSQL · GitHub API</p>
  <p>Todos los derechos reservados.</p>
</footer>

    </main>
    {collectionOpen && <div className="collection-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setCollectionOpen(false); }}>
      <section className="collection-modal" role="dialog" aria-modal="true" aria-labelledby="collection-title">
        <div className="collection-header">
          <div><span className="label">TU COLECCIÓN EN POSTGRESQL</span><h2 id="collection-title">Mi colección</h2><p>Perfiles y repositorios que has guardado.</p></div>
          <button className="collection-close" onClick={() => setCollectionOpen(false)} aria-label="Cerrar colección"><X size={22}/></button>
        </div>
        {dbError && <p className="error-text" role="alert">No se pudo actualizar la colección: {dbError}</p>}
        <div className="collection-content">
          <h3>Perfiles guardados ({profiles.length})</h3>
          <div className="saved-profiles">{profiles.map(p => <div className="saved-profile" key={p.github_id}>{p.avatar_url && <img src={p.avatar_url} alt=""/>}<div><strong>@{p.login}</strong><small>{p.name || 'Perfil público'}</small></div><button onClick={() => {setInput(p.login);setUsername(p.login);setCollectionOpen(false);window.scrollTo({top:0,behavior:'smooth'});}}>Analizar</button><button disabled={savingProfile} onClick={async () => {setSavingProfile(true);try {await request(BACKEND + '/profiles/' + p.github_id, {method:'DELETE'});await reloadSaved();notify('collection', 'profiles', 'Perfil eliminado exitosamente');} catch(e) {setDbError(e.message);} finally {setSavingProfile(false);}}}>Eliminar</button></div>)}</div>
          {profiles.length === 0 && <p className="empty-note">Aún no tienes perfiles guardados.</p>}
          <h3 className="saved-title">Repositorios favoritos ({favorites.length})</h3>
          <div className="repo-grid">{favorites.map(f => <article className="repo" key={f.github_id}><h3><a href={f.html_url} target="_blank" rel="noreferrer">{f.full_name}</a></h3><p>{f.description || 'Sin descripción.'}</p><div className="repo-meta"><span>{f.language || 'Sin lenguaje'}</span><span><Star size={14}/>{format(f.stars)}</span></div><button className="save-btn" disabled={savingRepo !== null} onClick={async () => {setSavingRepo(f.github_id);try {await request(BACKEND + '/favorites/' + f.github_id, {method:'DELETE'});await reloadSaved();notify('collection', 'favorites', 'Repositorio eliminado exitosamente');} catch(e) {setDbError(e.message);} finally {setSavingRepo(null);}}}>Eliminar favorito</button></article>)}</div>
          {favorites.length === 0 && <p className="empty-note">Aún no tienes repositorios favoritos.</p>}
        </div>
        {toast?.type === 'collection' && <div className="collection-toast" role="status"><CheckCircle2 size={16}/>{toast.message}</div>}
      </section>
    </div>}
  </div>;
}
