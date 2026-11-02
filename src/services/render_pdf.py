import sys, os, json, math
import pymupdf

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing arguments"}))
        sys.exit(1)
    pdf_path = sys.argv[1]
    out_dir = sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)

    try:
        doc = pymupdf.open(pdf_path)
        if len(doc) == 0:
            print(json.dumps({"error": "Empty PDF"}))
            sys.exit(1)

        page = doc[0]
        rect = page.rect
        width = rect.width
        height = rect.height

        dpi = 300
        scale = dpi / 72.0
        pix = page.get_pixmap(dpi=dpi)
        full_img_path = os.path.join(out_dir, "page_full.png")
        pix.save(full_img_path)

        # Extract text-layer spans (for PDFs that have text)
        spans = []
        try:
            d = page.get_text("dict")
            for block in d.get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span.get("text", "")
                        if not text:
                            continue
                        spans.append({
                            "text": text,
                            "bbox": span.get("bbox"),  # [x0,y0,x1,y1] page coords
                            "font": span.get("font"),
                        })
        except Exception as e:
            spans = []
            print(json.dumps({"warning": f"span extraction failed: {e}"}), file=sys.stderr)

        # Find MAKANI placeholder box (the empty box that should receive the QR)
        makani_box = None
        images = page.get_image_info(xrefs=True)
        for info in images:
            bbox = info["bbox"]
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            # The MAKANI box is roughly square ~50-75pt, on the right side
            if 40 < w < 90 and 40 < h < 90 and bbox[0] > width * 0.5:
                # prefer one near bottom-middle
                if makani_box is None or bbox[1] > makani_box[1]:
                    makani_box = {"bbox": list(bbox), "width": w, "height": h, "xref": info.get("xref")}
                elif abs(bbox[1] - makani_box[1]) < 5 and bbox[2] > makani_box[2]:
                    makani_box = {"bbox": list(bbox), "width": w, "height": h, "xref": info.get("xref")}

        # Also check for empty rectangle drawings that might be the placeholder
        if makani_box is None:
            try:
                for drawing in page.get_drawings():
                    items = drawing.get("items", [])
                    for item in items:
                        if item[0] == "re":  # rectangle
                            rectd = item[1]
                            rw = rectd.x1 - rectd.x0
                            rh = rectd.y1 - rectd.y0
                            if 40 < rw < 90 and 40 < rh < 90 and rectd.x0 > width * 0.5:
                                if makani_box is None or rectd.y1 > makani_box["bbox"][3]:
                                    makani_box = {"bbox": [rectd.x0, rectd.y0, rectd.x1, rectd.y1], "width": rw, "height": rh}
            except Exception:
                pass

        info = {
            "success": True,
            "pageCount": len(doc),
            "width": width,
            "height": height,
            "dpi": dpi,
            "scale": scale,
            "imageWidth": pix.width,
            "imageHeight": pix.height,
            "fullImagePath": full_img_path,
            "spans": spans,
            "makaniBox": makani_box,
        }
        print(json.dumps(info))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
