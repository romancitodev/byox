//! Cliente de la API de byox (la misma que usa la web, en http://localhost:3333/api).

use anyhow::{Context, Result, bail};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

pub struct Api {
  base: String,
  token: Option<String>,
}

#[derive(Deserialize, Clone)]
pub struct Where {
  pub path: String,
  pub line: u32,
  pub col: Option<u32>,
}

impl std::fmt::Display for Where {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    match self.col {
      Some(c) => write!(f, "{}:{}:{}", self.path, self.line, c),
      None => write!(f, "{}:{}", self.path, self.line),
    }
  }
}

/// El último resultado del CI para una etapa.
#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TestResult {
  pub ok: bool,
  pub at: String,
  pub sha: String,
  pub run_url: Option<String>,
  pub message: Option<String>,
  pub kind: Option<String>,
  #[serde(rename = "where")]
  pub location: Option<Where>,
  pub log: Option<String>,
  #[serde(default)]
  pub highlight: Vec<usize>,
}

impl TestResult {
  /// Esqueleto sin tocar: el test llega al `todo!()` (o `NotImplementedError`).
  pub fn not_started(&self) -> bool {
    self.kind.as_deref() == Some("todo")
  }
}

#[derive(Deserialize, Clone)]
pub struct Milestone {
  pub id: String,
  pub title: String,
}

#[derive(Deserialize, Clone)]
pub struct Issue {
  pub n: u32,
  pub title: String,
  pub milestone: String,
  pub deps: Vec<u32>,
  pub state: String,
  pub hints: u32,
  pub result: Option<TestResult>,
}

impl Issue {
  pub fn failing(&self) -> bool {
    self.state != "done" && self.result.as_ref().is_some_and(|r| !r.ok && !r.not_started())
  }
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Course {
  pub started: bool,
  pub title: String,
  pub image: String,
  pub milestones: Vec<Milestone>,
  pub issues: Vec<Issue>,
  pub clone_url: String,
}

impl Course {
  pub fn issue(&self, n: u32) -> Option<&Issue> {
    self.issues.iter().find(|i| i.n == n)
  }
  pub fn done(&self) -> usize {
    self.issues.iter().filter(|i| i.state == "done").count()
  }
  /// La etapa en la que conviene seguir: la primera disponible.
  pub fn current(&self) -> Option<&Issue> {
    self.issues.iter().find(|i| i.state == "ready")
  }
}

#[derive(Deserialize)]
pub struct CourseSummary {
  pub slug: String,
  pub title: String,
  pub description: String,
  pub started: bool,
  pub done: u32,
  pub total: u32,
  /// "human" si lo armó una persona a mano, "ai" si lo escribió un asistente.
  #[serde(default)]
  pub origin: Option<String>,
}

#[derive(Deserialize)]
pub struct Template {
  pub lang: String,
  pub label: String,
  pub image: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewCourse {
  pub slug: String,
  pub clone_url: String,
}

/// En qué quedó la verificación del último commit del repo fuente.
#[derive(Deserialize)]
pub struct VerifySummary {
  /// "none", "pending", "success", "failure" o "invalid"
  pub state: String,
  pub busy: bool,
}

/// Una etapa verificada: con el esqueleto tiene que fallar y con la solución pasar.
#[derive(Deserialize)]
pub struct StageCheck {
  pub id: u32,
  pub title: String,
  pub skeleton: String,
  pub solution: String,
  pub ok: bool,
  pub log: Option<String>,
}

#[derive(Deserialize)]
pub struct Verification {
  pub sha: String,
  pub state: String,
  pub image: Option<String>,
  pub errors: Vec<String>,
  pub stages: Vec<StageCheck>,
}

#[derive(Deserialize)]
pub struct AuthorStatus {
  pub slug: String,
  pub sha: String,
  pub message: String,
  pub title: String,
  pub origin: Option<String>,
  pub errors: Vec<String>,
  pub warnings: Vec<String>,
  pub verify: VerifySummary,
  pub last: Option<Verification>,
  pub started: bool,
}

#[derive(Deserialize)]
pub struct Export {
  pub title: String,
  pub sha: String,
  pub verified: bool,
  pub files: u32,
  pub bytes: usize,
  pub filename: String,
  pub code: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
  pub title: String,
  pub description: String,
  pub image: Option<String>,
  pub origin: Option<String>,
  pub author: Option<String>,
  pub issues: u32,
  pub milestones: Vec<String>,
  pub files: u32,
  pub verified: bool,
  pub exported_by: Option<String>,
  pub exists: bool,
  pub slug: String,
  pub suggested_slug: String,
  pub errors: Vec<String>,
}

#[derive(Deserialize)]
pub struct Imported {
  pub slug: String,
  pub title: String,
}

#[derive(Deserialize)]
pub struct Hint {
  pub k: u32,
  pub markdown: String,
}

#[derive(Deserialize)]
pub struct IssueDetail {
  pub markdown: String,
  pub hints: Vec<Hint>,
  pub url: String,
  pub result: Option<TestResult>,
}

#[derive(Deserialize)]
pub struct Run {
  pub sha: String,
  pub message: String,
  pub at: String,
  pub state: String,
}

#[derive(Deserialize)]
pub struct Status {
  pub run: Option<Run>,
}

/// Carpeta de configuración del CLI: %APPDATA%\byox, o ~/.config/byox.
fn config_dir() -> Option<std::path::PathBuf> {
  let base = std::env::var_os("APPDATA")
    .or_else(|| std::env::var_os("XDG_CONFIG_HOME"))
    .map(std::path::PathBuf::from)
    .or_else(|| std::env::var_os("HOME").map(|h| std::path::PathBuf::from(h).join(".config")))?;
  Some(base.join("byox"))
}

/// El token personal: BYOX_TOKEN, o el guardado con `byox login`.
fn token() -> Option<String> {
  let from_env = std::env::var("BYOX_TOKEN").ok().filter(|t| !t.trim().is_empty());
  from_env.or_else(|| {
    let t = std::fs::read_to_string(config_dir()?.join("token")).ok()?;
    Some(t.trim().to_string()).filter(|t| !t.is_empty())
  })
}

/// Guarda el token para las próximas veces. Devuelve dónde quedó.
pub fn save_token(t: &str) -> Result<std::path::PathBuf> {
  let dir = config_dir().context("no encontré dónde guardar la configuración")?;
  std::fs::create_dir_all(&dir)?;
  let file = dir.join("token");
  std::fs::write(&file, format!("{}\n", t.trim()))?;
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o600))?;
  }
  Ok(file)
}

impl Api {
  pub fn new() -> Self {
    let base = std::env::var("BYOX_URL").unwrap_or_else(|_| "http://localhost:3333".into());
    Api { base: base.trim_end_matches('/').to_string(), token: token() }
  }

  /// Agrega el token personal (`byox_…`) a la request, si hay.
  fn auth(&self, req: ureq::Request) -> ureq::Request {
    match &self.token {
      Some(t) => req.set("Authorization", &format!("Bearer {t}")),
      None => req,
    }
  }

  /// Los errores 401 piden un token; el resto, el mensaje que manda la API.
  fn status_error(&self, code: u16, res: ureq::Response, fallback: String) -> anyhow::Error {
    if code == 401 {
      return anyhow::anyhow!(
        "byox pide iniciar sesión. Crea un token en la web (Cuenta → Tokens) y ejecuta `byox login <token>`, o define BYOX_TOKEN."
      );
    }
    let msg = res.into_json::<Value>().ok().and_then(|v| v["error"].as_str().map(String::from));
    anyhow::anyhow!("{}", msg.unwrap_or(fallback))
  }

  pub fn web_url(&self, path: &str) -> String {
    format!("{}{path}", self.base)
  }

  fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
    let url = format!("{}/api{path}", self.base);
    match self.auth(ureq::get(&url)).call() {
      Ok(res) => res.into_json().with_context(|| format!("respuesta inválida de {url}")),
      Err(ureq::Error::Status(code, res)) => Err(self.status_error(code, res, format!("no existe: {path}"))),
      Err(ureq::Error::Transport(_)) => bail!(
        "no pude conectarme a byox en {}. ¿Está levantado? (docker compose up -d en la carpeta de byox)",
        self.base
      ),
    }
  }

  pub fn courses(&self) -> Result<Vec<CourseSummary>> {
    self.get("/courses")
  }
  pub fn course(&self, slug: &str) -> Result<Course> {
    self.get(&format!("/courses/{slug}"))
  }
  pub fn issue(&self, slug: &str, n: u32) -> Result<IssueDetail> {
    self.get(&format!("/courses/{slug}/issues/{n}"))
  }
  pub fn status(&self, slug: &str) -> Result<Status> {
    self.get(&format!("/courses/{slug}/status"))
  }
  pub fn ask_hint(&self, slug: &str, n: u32) -> Result<()> {
    match self.auth(ureq::post(&format!("{}/api/courses/{slug}/issues/{n}/hint", self.base))).call() {
      Ok(_) => Ok(()),
      Err(ureq::Error::Status(code, res)) => Err(self.status_error(code, res, "no pude pedir la pista".into())),
      Err(e) => Err(e.into()),
    }
  }

  /// POST con JSON. Si la API contesta con error, el mensaje es el `error` que manda.
  fn post<T: DeserializeOwned>(&self, path: &str, body: Value) -> Result<T> {
    let url = format!("{}/api{path}", self.base);
    match self.auth(ureq::post(&url)).send_json(body) {
      Ok(res) => res.into_json().with_context(|| format!("respuesta inválida de {url}")),
      Err(ureq::Error::Status(code, res)) => Err(self.status_error(code, res, format!("falló {path}"))),
      Err(ureq::Error::Transport(_)) => bail!(
        "no pude conectarme a byox en {}. ¿Está levantado? (docker compose up -d en la carpeta de byox)",
        self.base
      ),
    }
  }

  pub fn templates(&self) -> Result<Vec<Template>> {
    self.get("/author/templates")
  }
  pub fn new_course(&self, slug: &str, lang: &str, title: Option<&str>) -> Result<NewCourse> {
    self.post("/author/new", serde_json::json!({ "slug": slug, "lang": lang, "title": title }))
  }
  pub fn author_status(&self, slug: &str) -> Result<AuthorStatus> {
    self.get(&format!("/author/{slug}"))
  }
  pub fn verify(&self, slug: &str) -> Result<()> {
    self.post::<Value>(&format!("/author/{slug}/verify"), Value::Null).map(|_| ())
  }
  pub fn guide(&self) -> Result<String> {
    let url = format!("{}/api/author/guide", self.base);
    match self.auth(ureq::get(&url)).call() {
      Ok(res) => Ok(res.into_string()?),
      Err(ureq::Error::Status(code, res)) => Err(self.status_error(code, res, "no pude leer la guía".into())),
      Err(e) => Err(e.into()),
    }
  }
  pub fn export(&self, slug: &str) -> Result<Export> {
    self.get(&format!("/courses/{slug}/export"))
  }
  pub fn preview(&self, code: &str) -> Result<Preview> {
    self.post("/import/preview", serde_json::json!({ "code": code }))
  }
  pub fn import(&self, code: &str, slug: &str) -> Result<Imported> {
    self.post("/import", serde_json::json!({ "code": code, "slug": slug }))
  }
  pub fn start(&self, slug: &str) -> Result<()> {
    self.post::<Value>(&format!("/courses/{slug}/start"), Value::Null).map(|_| ())
  }
}
