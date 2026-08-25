# = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
# _purl.R -- turn a session .qmd into the in-class live script.
#
# One source per session. The .qmd holds the prose, the code, and the
# exercises; Quarto renders the manual page and the slides from it, and this
# turns the same file into a runnable .R in the 2025 in-class style. Nothing
# is retyped anywhere, so the three artifacts cannot drift apart.
#
# Chunk options read here (all optional):
#   #| script: "Pull the data"  -- section header, emitted as `# Pull the data ----`
#   #| exercise: true           -- wrap the chunk in the `# = = =` banner box
#   #| purl: false              -- skip the chunk entirely (setup, plumbing)
# With no `script:` option the chunk label is used: `pull-the-data` becomes
# `Pull the data`. Unlabelled chunks are appended to the section above them.
#
# Called from a hidden chunk at the foot of each session .qmd, so a plain
# `quarto render` produces all three artifacts. When there are enough sessions
# to want a single build step, move this to R/ and call it from a project
# `pre-render` hook -- the function does not change.
# = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

.rule <- paste0("# ", paste(rep("=", 38), collapse = " "))

# YAML front matter, shallow: enough to title the script, no dependency.
.front_matter <- function(src) {
  if (!length(src) || !grepl("^---\\s*$", src[1])) return(list())
  ends <- which(grepl("^---\\s*$", src))
  if (length(ends) < 2) return(list())
  fm <- src[2:(ends[2] - 1)]
  get <- function(key) {
    hit <- grep(sprintf("^%s:\\s", key), fm, value = TRUE)
    if (!length(hit)) return(NA_character_)
    val <- sub(sprintf("^%s:\\s*", key), "", hit[1])
    trimws(gsub('^"|"$', "", trimws(val)))
  }
  list(title = get("title"), subtitle = get("subtitle"))
}

.chunk_label <- function(open_line) {
  inside <- sub("^```+\\s*\\{r\\s*", "", open_line)
  inside <- sub("\\}\\s*$", "", inside)
  label <- trimws(strsplit(inside, ",")[[1]][1])
  if (is.na(label) || !nzchar(label) || grepl("=", label)) "" else label
}

# `#| key: value` lines at the head of a chunk body.
.chunk_opts <- function(body) {
  raw <- grep("^\\s*#\\|", body, value = TRUE)
  if (!length(raw)) return(list())
  kv <- sub("^\\s*#\\|\\s*", "", raw)
  keys <- sub(":.*$", "", kv)
  vals <- trimws(sub("^[^:]*:\\s*", "", kv))
  vals <- gsub('^"|"$', "", vals)
  stats::setNames(as.list(vals), trimws(keys))
}

.prettify <- function(label) {
  txt <- gsub("-", " ", label)
  sub("^(.)", "\\U\\1", txt, perl = TRUE)
}

#' Extract the runnable script from a session .qmd
#'
#' @param qmd    path to the session source
#' @param out    path to write; defaults to the .qmd path with an .R extension
#' @param course banner line 1
#' @param how    banner line for how to run it
#' @return `out`, invisibly
purl_session <- function(qmd,
                         out = sub("\\.qmd$", ".R", qmd),
                         course = "AEM 6850 -- Empirical Methods for Applied Economists",
                         how = paste("Run it one line at a time: put the cursor on a line and press",
                                     "Cmd-Return (Mac) or Ctrl-Enter (Windows).")) {

  src <- readLines(qmd, warn = FALSE)
  fm <- .front_matter(src)

  # "1 · Course overview, ..." reads better as "Session 1 -- Course overview, ..."
  session_line <- if (!is.na(fm$title)) {
    sub("^([0-9]+)\\s*·\\s*", "Session \\1 -- ", fm$title)
  } else NA_character_

  banner <- c(
    .rule,
    paste0("# ", course),
    if (!is.na(session_line)) paste0("# ", session_line),
    if (!is.na(fm$subtitle)) paste0("# ", fm$subtitle),
    "#",
    paste0("# ", strwrap(how, width = 74)),
    "#",
    paste0("# Generated from ", basename(qmd), " -- edit the .qmd, not this file."),
    .rule
  )

  body_out <- character()
  i <- 1L
  n <- length(src)
  while (i <= n) {
    if (!grepl("^```+\\s*\\{r[ ,}]", src[i])) {
      i <- i + 1L
      next
    }
    open <- i
    j <- i + 1L
    while (j <= n && !grepl("^```+\\s*$", src[j])) j <- j + 1L
    chunk <- if (j > open + 1L) src[(open + 1L):(j - 1L)] else character()
    opts <- .chunk_opts(chunk)
    code <- chunk[!grepl("^\\s*#\\|", chunk)]
    i <- j + 1L

    if (identical(opts$purl, "false")) next

    header <- if (!is.null(opts$script)) opts$script else {
      label <- .chunk_label(src[open])
      if (!nzchar(label) && !is.null(opts$label)) label <- opts$label
      if (nzchar(label)) .prettify(label) else NA_character_
    }

    # Trim blank lines at both ends; spacing is this function's job.
    while (length(code) && !nzchar(trimws(code[1]))) code <- code[-1]
    while (length(code) && !nzchar(trimws(code[length(code)]))) code <- code[-length(code)]
    if (!length(code)) next

    if (identical(opts$exercise, "true")) {
      body_out <- c(body_out, "", "", .rule,
                    if (!is.na(header)) paste0("# ", header, " ----"),
                    code, .rule, "", "")
    } else {
      body_out <- c(body_out, "", "",
                    if (!is.na(header)) paste0("# ", header, " ----"),
                    code)
    }
  }

  # Collapse the blank lines the loop always pads with at either end.
  while (length(body_out) && !nzchar(body_out[1])) body_out <- body_out[-1]
  while (length(body_out) && !nzchar(body_out[length(body_out)])) {
    body_out <- body_out[-length(body_out)]
  }

  writeLines(c(banner, "", body_out, "", "", "# The end"), out)
  invisible(out)
}
