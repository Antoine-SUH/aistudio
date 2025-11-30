import React, { useState } from 'react';
import { Upload, Trash2, AlertTriangle } from 'lucide-react';
import { Header } from './components/layout/Header';
import { GeneratorView } from './features/Editor';
import { CreatorView } from './features/Creator';
import { DocxManager } from './core/DocxManager';
import { DocxTag, ViewMode, AppError } from './types';
import { Button } from './components/ui/Button';

const App: React.FC = () => {
  // --- Global Application State ---
  const [manager] = useState(() => new DocxManager());
  const [fileLoaded, setFileLoaded] = useState(false);
  const [fileName, setFileName] = useState("");
  const [tags, setTags] = useState<DocxTag[]>([]);
  const [error, setError] = useState<AppError | null>(null);
  
  // Navigation State
  const [currentView, setCurrentView] = useState<ViewMode>('generator');
  
  // Navigation Warning State
  const [pendingView, setPendingView] = useState<ViewMode | null>(null);
  const [isNavigationWarningOpen, setIsNavigationWarningOpen] = useState(false);

  // --- Handlers ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const arrayBuffer = await file.arrayBuffer();
      
      // Load Core
      manager.load(arrayBuffer);
      
      // Extract initial info
      const detectedTags = manager.getTags();
      
      setTags(detectedTags);
      setFileName(file.name);
      setFileLoaded(true);

    } catch (err: any) {
      console.error("Erreur de chargement:", err);
      setError({ title: "Erreur de chargement", message: err.message || "Erreur inconnue" });
      setFileLoaded(false);
    }
  };

  const handleTagsUpdated = () => {
    try {
        const updatedTags = manager.getTags();
        setTags(updatedTags);
    } catch (e) {
        console.error("Impossible de rafraîchir les balises", e);
    }
  };

  const resetFileState = () => {
    setFileLoaded(false);
    setTags([]);
    setFileName("");
    setError(null);
  };

  const requestViewChange = (newView: ViewMode) => {
    if (newView === currentView) return;

    if (fileLoaded) {
        setPendingView(newView);
        setIsNavigationWarningOpen(true);
    } else {
        setCurrentView(newView);
    }
  };

  const confirmNavigation = () => {
      if (pendingView) {
          resetFileState();
          setCurrentView(pendingView);
      }
      setIsNavigationWarningOpen(false);
      setPendingView(null);
  };

  const cancelNavigation = () => {
      setIsNavigationWarningOpen(false);
      setPendingView(null);
  };

  // --- Render ---

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 h-screen overflow-hidden">
      <Header 
        currentView={currentView} 
        onViewChange={requestViewChange} 
        disabled={false} 
      />
      
      <main className="flex-1 relative overflow-hidden">
        {!fileLoaded ? (
            // Upload Screen
            <div className="flex flex-col items-center justify-center h-full p-6">
                <div className="bg-white p-10 rounded-xl shadow-xl text-center max-w-lg w-full border border-slate-200 relative">
                    <div className="bg-primary-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary-600">
                        <Upload size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                        {currentView === 'generator' ? 'Charger un Modèle' : 'Créer un Modèle'}
                    </h2>
                    <p className="text-slate-500 mb-8">
                        {currentView === 'generator' 
                            ? 'Chargez un fichier DOCX pour commencer à générer des documents.'
                            : 'Chargez un fichier DOCX pour convertir du texte en balises.'
                        }
                    </p>
                    
                    <label className="block w-full">
                        <input 
                        type="file" 
                        accept=".docx" 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        />
                        <div className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-lg cursor-pointer transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                        <span>Choisir un fichier</span>
                        </div>
                    </label>
                    
                    {error && (
                        <div className="mt-6 p-4 bg-red-50 text-red-700 text-sm rounded-md border border-red-200 text-left">
                        <span className="font-bold block mb-1">{error.title}</span>
                        <pre className="whitespace-pre-wrap font-mono text-xs">{error.message}</pre>
                        </div>
                    )}
                </div>
            </div>
        ) : (
            // Main App Views
            <>
                <div className="absolute top-4 right-4 z-50">
                     <button onClick={resetFileState} className="bg-white p-2 rounded-full shadow text-slate-400 hover:text-red-500 transition-colors" title="Fermer le fichier">
                        <Trash2 size={20} />
                    </button>
                </div>

                {currentView === 'generator' ? (
                    <GeneratorView 
                        manager={manager} 
                        tags={tags} 
                        fileName={fileName} 
                    />
                ) : (
                    <CreatorView 
                        manager={manager} 
                        fileName={fileName} 
                        onTagsUpdated={handleTagsUpdated}
                    />
                )}
            </>
        )}
      </main>

      {/* Navigation Warning Modal */}
      {isNavigationWarningOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 m-4 border-l-4 border-yellow-500">
                  <div className="flex items-start gap-4 mb-4">
                      <div className="bg-yellow-100 p-2 rounded-full text-yellow-600 shrink-0">
                          <AlertTriangle size={24} />
                      </div>
                      <div>
                          <h3 className="font-bold text-lg text-slate-800">Changement de mode</h3>
                          <p className="text-slate-600 mt-2 text-sm leading-relaxed">
                            Smart Docx Editor n'enregistre rien, veillez à bien télécharger vos documents modifiés avant de changer de page.
                          </p>
                      </div>
                  </div>
                  
                  <div className="flex gap-3 justify-end mt-6">
                      <Button onClick={cancelNavigation} variant="outline" className="text-slate-600">
                          Annuler
                      </Button>
                      <Button onClick={confirmNavigation} variant="primary">
                          Continuer
                      </Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;