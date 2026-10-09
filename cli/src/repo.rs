//! El repo del curso en el que estás parado: raíz, slug, imagen y commit.

use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{Context, Result, bail};
use serde::Deserialize;

pub struct Repo {
  pub root: PathBuf,
  pub slug: String,
  pub image: String,
}

#[derive(Deserialize)]
struct CourseJson {
  image: String,
}

fn git(dir: &Path, args: &[&str]) -> Option<String> {
  let out = Command::new("git").args(args).current_dir(dir).output().ok()?;
  out.status.success().then(|| String::from_utf8_lossy(&out.stdout).trim().to_string())
}

impl Repo {
  /// Busca hacia arriba un repo con `.course/course.json`.
  pub fn find() -> Result<Repo> {
    let cwd = std::env::current_dir()?;
    let root = cwd
      .ancestors()
      .find(|d| d.join(".course").join("course.json").is_file())
      .map(Path::to_path_buf);
    let Some(root) = root else {
      bail!("no estás dentro del repo de un curso de byox (no encontré .course/course.json). Usá `byox clone <curso>` o pasá --course");
    };
    let raw = std::fs::read_to_string(root.join(".course/course.json")).context("no pude leer .course/course.json")?;
    let course: CourseJson = serde_json::from_str(&raw).context(".course/course.json está roto")?;
    let slug = slug_of(&root)?;
    Ok(Repo { root, slug, image: course.image })
  }

  pub fn head(&self) -> Option<String> {
    git(&self.root, &["rev-parse", "HEAD"])
  }

  /// Commits locales que todavía no están en origin/main.
  pub fn unpushed(&self) -> usize {
    unpushed(&self.root)
  }
}

/// El slug es el nombre del repo en Forgejo; si no hay remote, el de la carpeta.
fn slug_of(root: &Path) -> Result<String> {
  git(root, &["remote", "get-url", "origin"])
    .and_then(|u| u.trim_end_matches('/').trim_end_matches(".git").rsplit('/').next().map(String::from))
    .or_else(|| root.file_name().map(|f| f.to_string_lossy().into_owned()))
    .context("no pude deducir el nombre del curso")
}

fn unpushed(root: &Path) -> usize {
  git(root, &["rev-list", "--count", "origin/main..HEAD"])
    .and_then(|n| n.parse().ok())
    .unwrap_or(0)
}

/// El repo fuente de un curso que estás escribiendo (el que tiene `course.yaml`).
pub struct Source {
  pub slug: String,
  /// Commits locales sin pushear: `byox check` mira lo que está en Forgejo.
  pub unpushed: usize,
}

impl Source {
  pub fn find() -> Option<Source> {
    let cwd = std::env::current_dir().ok()?;
    let root = cwd.ancestors().find(|d| d.join("course.yaml").is_file() && d.join(".git").exists())?;
    Some(Source { slug: slug_of(root).ok()?, unpushed: unpushed(root) })
  }
}
