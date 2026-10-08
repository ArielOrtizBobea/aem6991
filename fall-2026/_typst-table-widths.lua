-- PDF syllabus only: let Typst size table columns to their content.
-- Pandoc gives every column of a long pipe table the same width, which
-- crushes a descriptive column into a narrow hyphenated strip in print.
function Table(tbl)
  if not quarto.doc.is_format("typst") then return nil end
  for i, spec in ipairs(tbl.colspecs) do
    tbl.colspecs[i] = { spec[1], pandoc.ColWidthDefault }
  end
  return tbl
end
