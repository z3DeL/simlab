import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../api/client';
import { useProject } from '../context/ProjectContext';
import { BookOpen, Download } from 'lucide-react';

export default function LabGuide() {
  const [labs, setLabs] = useState([]);
  const [activeLab, setActiveLab] = useState(null);
  const { updateProject } = useProject();

  useEffect(() => {
    const fetchLabs = async () => {
      try {
        const { data } = await api.get('/lab_works/');
        setLabs(data);
        if (data.length > 0) setActiveLab(data[0]);
      } catch (err) {
        console.error('Failed to load lab works', err);
      }
    };
    fetchLabs();
  }, []);

  const handleLoadSchema = () => {
    if (!activeLab || !activeLab.default_schema_json) return;
    updateProject({ schema_json: activeLab.default_schema_json });
  };

  if (!activeLab) return (
    <div className="empty-state" style={{ marginTop: '60px' }}>
      <BookOpen size={40} />
      <p>Загрузка лабораторных работ...</p>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        padding: '10px 14px', borderBottom: '1px solid var(--border-color)', 
        backgroundColor: 'var(--bg-secondary)', display: 'flex', gap: '10px', alignItems: 'center' 
      }}>
        <select 
          className="select-field" 
          value={activeLab.id} 
          onChange={(e) => setActiveLab(labs.find(l => l.id === parseInt(e.target.value)))}
          style={{ flex: 1, padding: '6px 10px', fontSize: '12.5px' }}
        >
          {labs.map(lab => (
            <option key={lab.id} value={lab.id}>{lab.title}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={handleLoadSchema} style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' }}>
          <Download size={13} /> Загрузить схему
        </button>
      </div>

      <div className="markdown-body" style={{ flex: 1, backgroundColor: 'var(--bg-primary)' }}>
        <ReactMarkdown>{activeLab.description_md}</ReactMarkdown>
      </div>
    </div>
  );
}
