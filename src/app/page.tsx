import PhotoGallery from '@/components/photo-gallery';

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex-1">
        <PhotoGallery />
      </main>
    </div>
  );
}
