import React, { useEffect, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import Note from "./Note";
import CreateArea from "./CreateArea";
import AuthForm from "./AuthForm";
import API_BASE_URL from "./config";

function App() {
  const [notes, setNotes] = useState([]);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchNotes(currentToken) {
    const response = await fetch(`${API_BASE_URL}/api/notes`, {
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load notes.");
    }

    const data = await response.json();
    setNotes(Array.isArray(data.notes) ? data.notes : []);
  }

  useEffect(() => {
    async function bootstrap() {
      const storedToken = localStorage.getItem("keep_notes_token");
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const meResponse = await fetch(`${API_BASE_URL}/api/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (!meResponse.ok) {
          localStorage.removeItem("keep_notes_token");
          setLoading(false);
          return;
        }

        const meData = await meResponse.json();
        setToken(storedToken);
        setUser(meData.user);
        await fetchNotes(storedToken);
      } catch (_bootstrapError) {
        setError("Could not connect to backend.");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  async function handleAuthSuccess({ token: newToken, user: newUser }) {
    localStorage.setItem("keep_notes_token", newToken);
    setToken(newToken);
    setUser(newUser);
    setError("");
    await fetchNotes(newToken);
  }

  function logout() {
    localStorage.removeItem("keep_notes_token");
    setToken("");
    setUser(null);
    setNotes([]);
    setError("");
  }

  async function addNote(newNote) {
    const response = await fetch(`${API_BASE_URL}/api/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newNote),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Failed to add note.");
    }

    const data = await response.json();
    if (data.note) {
      setNotes((prevNotes) => [data.note, ...prevNotes]);
    }
  }

  async function deleteNote(id) {
    const response = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Failed to delete note.");
    }

    setNotes((prevNotes) => {
      return prevNotes.filter((noteItem) => {
        return noteItem.id !== id;
      });
    });
  }

  if (loading) {
    return (
      <div>
        <Header />
        <p className="status-message">Loading...</p>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <Header />
        <AuthForm onAuthSuccess={handleAuthSuccess} />
        {error ? <p className="error-message">{error}</p> : null}
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Header userEmail={user.email} onLogout={logout} />
      {error ? <p className="error-message">{error}</p> : null}
      <CreateArea onAdd={addNote} onError={setError} />
      {notes.map((noteItem) => {
        return (
          <Note
            key={noteItem.id}
            id={noteItem.id}
            title={noteItem.title}
            content={noteItem.content}
            onDelete={deleteNote}
            onError={setError}
          />
        );
      })}
      <Footer />
    </div>
  );
}

export default App;
