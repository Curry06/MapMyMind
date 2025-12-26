let cy = cytoscape({
  container: document.getElementById("cy"),
  style: [
    {
      selector: "node",
      style: {
        shape: "data(shape)",
        width: "data(w)",
        height: "data(h)",
        backgroundColor: "data(bgColor),#000",
        label: "data(label)",
        color: "#000",
        "text-valign": "center",
        "text-halign": "center",
        "font-size": 14,
        "font-weight": "bold",
        padding: 0,
       
      },
    },
    {
      selector: "edge",
      style: {
        width: "3",
        "line-color": "data(edgeColor)",
        "line-style": "data(lineStyle)",
        "curve-style": "bezier",
        "target-arrow-shape": "triangle",
        "target-arrow-color": "data(edgeColor)",
      },
    },
  ],
  wheelSensitivity: 0.05,
});

let connectMode = false;
let sourceNode = null;
let currentElement = null;

let fileHandle = null;

// Toggle connect mode
document.getElementById("connectModeBtn").onclick = () => {
  connectMode = !connectMode;
  document.getElementById("connectModeBtn").innerText = `Connect Mode: ${
    connectMode ? "ON" : "OFF"
  }`;
  sourceNode = null;
};

// Save file (pick or create file)
document.getElementById("chooseFileBtn").onclick = async () => {
  try {
    fileHandle = await window.showSaveFilePicker({
      types: [
        {
          description: "JSON Files",
          accept: { "application/json": [".json"] },
        },
      ],
    });
    await writeToFile();
  } catch (err) {
    console.warn("File save picker cancelled or failed:", err);
  }
};

// Manual save
document.getElementById("manualSaveBtn").onclick = async () => {
  if (!fileHandle) {
    alert(" No file selected. Please click 'Save File' first.");
    return;
  }
  await writeToFile();
  alert(" Saved successfully.");
};

// Load from file
document.getElementById("loadFileBtn").onclick = async () => {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: "JSON Files",
        accept: { "application/json": [".json"] }
      }],
      multiple: false
    });

    const file = await handle.getFile();
    const content = await file.text();
    const parsed = JSON.parse(content);

    cy.elements().remove();

    if (parsed.elements) {
      cy.add(parsed.elements);
    }

    if (parsed.pan) cy.pan(parsed.pan);
    if (parsed.zoom) cy.zoom(parsed.zoom);

    // ✅ IMPORTANT: DO NOT TOUCH bgColor here

    console.log("Graph loaded correctly");
  } catch (err) {
    console.warn("Load failed:", err);
  }
};


// Write to selected file
async function writeToFile() {
  if (!fileHandle) return;
  try {
    const writable = await fileHandle.createWritable();
    const state = {
      elements: cy.elements().jsons(),
      pan: cy.pan(),
      zoom: cy.zoom(),
    };
    await writable.write(JSON.stringify(state, null, 2));
    await writable.close();
    console.log("Saved to file.");
  } catch (err) {
    console.error("Failed to write file:", err);
  }
}

// Auto save on actions
function saveState() {
  writeToFile();
}

function getCanvasCenter() {
  const pan = cy.pan();
  const zoom = cy.zoom();
  const width = cy.width();
  const height = cy.height();
  return {
    x: (width / 2 - pan.x) / zoom,
    y: (height / 2 - pan.y) / zoom,
  };
}

function calculateNodeSize(label) {
  const minSize = 80;      
  const charWidth = 7;    
  const padding = 30;

  const textWidth = label.length * charWidth + padding;
  const size = Math.max(minSize, textWidth);

  return {
    w: size,
    h: size
  };
}


let nodecount=0;
// Add node
document.getElementById('addNodeBtn').onclick = () => {
  const label = prompt('Enter node label');
  if (!label) return;

  const shape = prompt('Shape (ellipse, triangle, diamond)', 'ellipse');

  const size = calculateNodeSize(label);
  const center = getCanvasCenter();

  cy.add({
    group: 'nodes',
    data: {
      id: `n${nodecount++}`,
      label: label,
      shape: shape,
      bgColor: '#eeeeee',
      ...size   // w and h injected here
    },
    position: center
  });

  saveState();
};


// Edge connect
cy.on("tap", "node", (evt) => {
  if (connectMode) {
    if (!sourceNode) {
      sourceNode = evt.target;
    } else {
      cy.add({
        group: "edges",
        data: { source: sourceNode.id(), target: evt.target.id() },
      });
      sourceNode = null;
      saveState();
    }
  }
});

//change edge color
document.getElementById("changeEdgecolor").onclick = () => {
  if (currentElement && currentElement.isEdge && currentElement.isEdge()) {
    const newColor = prompt("Enter new edge color:", currentElement.data("edgeColor"));
    if (!newColor) return ;

    currentElement.data("edgeColor", newColor);
    saveState();
  }
};

// change type of edge
document.querySelectorAll(".line-type-option button").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!currentElement || !currentElement.isEdge()) return;

    const lineType = btn.getAttribute("data-line");

    currentElement.data("lineStyle", lineType);

    saveState();
  });
});


// Insert node between edge
cy.on("tap", "edge", (evt) => {
  const edge = evt.target;
  const source = edge.source();
  const target = edge.target();
  const midpoint = {
    x: (source.position("x") + target.position("x")) / 2,
    y: (source.position("y") + target.position("y")) / 2,
  };
// load file properly 
cy.nodes().forEach((node) => {
  if (!node.data("bgColor")) {
    node.data("bgColor",); // default
  }
});


  const id = `n${cy.nodes().length}`;
  const label = prompt(
    "Enter label for new node between:",
    `Node ${cy.nodes().length}`
  );
  if (!label) return;

  cy.remove(edge);

  cy.add([
    {
      group: "nodes",
      data: { id, label, bgColor: "#eeeeee", textColor: "#333333" },
      position: midpoint,
    },
    { group: "edges", data: { source: source.id(), target: id } },
    { group: "edges", data: { source: id, target: target.id() } },
  ]);

  saveState();
});

// Right click menu
cy.on("cxttap", "node, edge", function (evt) {
  currentElement = evt.target;
  const e = evt.originalEvent;
  document.getElementById("contextMenu").style.left = e.clientX + "px";
  document.getElementById("contextMenu").style.top = e.clientY + "px";
  document.getElementById("contextMenu").style.display = "block";
});

// Hide context menu
cy.on("tap", () => {
  document.getElementById("contextMenu").style.display = "none";
});

// Rename
document.getElementById("renameNode").onclick = () => {
  if (currentElement && currentElement.isNode && currentElement.isNode()) {
    const newLabel = prompt("Enter new label:", currentElement.data("label"));
    if (!newLabel) return ;
    const size = calculateNodeSize(newLabel);
    
    currentElement.data({
      label: newLabel,
      ...size   // update w and h
    });
    saveState();
  }
};

// Delete
document.getElementById("deleteNode").onclick = () => {
  if (currentElement) {
    cy.remove(currentElement);
    saveState();
  }
};

// Color change
document.querySelectorAll(".color-option span").forEach((span) => {
  span.addEventListener("click", () => {
    const color = span.getAttribute("data-color");
    if (currentElement && currentElement.isNode && currentElement.isNode()) {
      currentElement.data("bgColor", color);
      currentElement.style({
        "background-color": color,
        "text-outline-color": color,
      });
      saveState();
    }
  });
});

// Save on zoom/pan/drag
cy.on("pan zoom", saveState);
cy.on("dragfree", "node", saveState);
