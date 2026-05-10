/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import Home from './components/Home';
import Editor from './components/Editor';
import PhotoEditor from './components/PhotoEditor';
import { Project, Clip } from './types/editor';

export default function App() {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [view, setView] = useState<'home' | 'video' | 'photo'>('home');

  const handleCreateProject = (files?: FileList | null) => {
    const newClips: Clip[] = [];
    if (files && files.length > 0) {
      Array.from(files).forEach((file, index) => {
        const type = file.type.startsWith('video') ? 'video' : 'photo';
        const url = URL.createObjectURL(file);
        newClips.push({
          id: `imported-${Date.now()}-${index}`,
          type: type as any,
          src: url,
          start: index * 3, // Each clip is 3s long and starts after the previous one
          duration: 3,
          trimStart: 0,
          speed: 1,
          layer: 0,
          scale: 1,
          x: 0,
          y: 0,
          opacity: 1,
          keyframes: []
        });
      });
    } else {
      // Fallback default clips
      newClips.push(
        {
          id: 'default-1',
          type: 'video',
          src: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600&auto=format&fit=crop',
          start: 0,
          duration: 3,
          trimStart: 0,
          speed: 1,
          layer: 0,
          scale: 1,
          x: 0,
          y: 0,
          opacity: 1,
          keyframes: []
        },
        {
          id: 'default-2',
          type: 'video',
          src: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=600&auto=format&fit=crop',
          start: 3,
          duration: 3,
          trimStart: 0,
          speed: 1,
          layer: 0,
          scale: 1,
          x: 0,
          y: 0,
          opacity: 1,
          keyframes: []
        }
      );
    }

    const newProject: Project = {
      id: Date.now().toString(),
      name: 'Proyek Baru',
      duration: newClips.length > 0 ? newClips.reduce((sum, c) => Math.max(sum, c.start + c.duration), 0) : 0,
      fps: 30,
      resolution: '1080p',
      aspectRatio: '9:16',
      clips: newClips,
      createdAt: Date.now(),
      thumbnail: newClips[0]?.type === 'photo' ? newClips[0].src : 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=300&auto=format&fit=crop'
    };
    setCurrentProject(newProject);
    setView('video');
  };

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project);
    setView('video');
  };

  const handleOpenPhotoEditor = () => {
    setView('photo');
  };

  const handleBack = () => {
    setCurrentProject(null);
    setView('home');
  };

  return (
    <div className="min-h-screen bg-[#0E0E0E] text-white overflow-hidden font-sans">
      {view === 'video' && currentProject ? (
        <Editor project={currentProject} onBack={handleBack} />
      ) : view === 'photo' ? (
        <PhotoEditor onBack={handleBack} />
      ) : (
        <Home 
          onCreateProject={handleCreateProject} 
          onOpenProject={handleOpenProject}
          onOpenPhotoEditor={handleOpenPhotoEditor} 
        />
      )}
    </div>
  );
}

