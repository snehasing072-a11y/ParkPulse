import { useEffect, useState } from 'react';
import { fetchRecentSearches } from './api/client';
import { Footer } from './components/Footer';
import { LandingSections } from './components/LandingSections';
import { LotDirectory } from './components/LotDirectory';
import { Navbar } from './components/Navbar';
import type { UserCoordinates } from './components/ParkingMap';
import { SearchForm } from './components/SearchForm';
import heroParkingImg from './assets/images/hero_parking_plaza_1794584550117.jpg';
import type { SearchRecord } from './types/parking';

export default function App() {
  const [recentSearches, setRecentSearches] = useState<SearchRecord[]>([]);
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [userCoords, setUserCoords] = useState<UserCoordinates | null>(null);

  useEffect(() => {
    fetchRecentSearches(5)
      .then(setRecentSearches)
      .catch(() => {
        // Non-blocking on initial landing load
      });
  }, []);

  function scrollToSearch() {
    const el = document.getElementById('search-form-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = document.getElementById('destination');
      input?.focus();
    }
  }

  return (
    <div id="top" className="min-h-screen bg-[#F5F7FA] text-[#101828]">
      <Navbar onSearchClick={scrollToSearch} />

      <main>
        <section className="mx-auto max-w-[1200px] px-6 pb-16 pt-10 sm:pt-14">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
            <div className="space-y-6 lg:col-span-6">
              <div>
                <h1
                  className="text-4xl font-extrabold tracking-tight text-[#101828] sm:text-5xl"
                  style={{ textWrap: 'balance' }}
                >
                  Find Your Parking Before You Arrive.
                </h1>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                  ParkPulse predicts slot availability across Greater Noida markets, transit hubs, campuses, and malls—combining transparent occupancy forecasts with walking distance and pricing preferences.
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {!heroImageFailed ? (
                  <img
                    src={heroParkingImg}
                    alt="Modern smart parking plaza with electric cyan wayfinding markers"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImageFailed(true)}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full flex-col items-center justify-center bg-[#101828] p-6 text-center text-white">
                    <span className="text-sm font-semibold text-[#00D4E5]">ParkPulse Urban Mobility</span>
                    <span className="mt-1 text-xs text-slate-300">Greater Noida Parking Intelligence</span>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-6">
              <SearchForm
                onSearchSaved={(record) => {
                  setRecentSearches((prev) => [record, ...prev.filter((r) => r.id !== record.id)].slice(0, 5));
                }}
                onCoordinatesDetected={(detected) => {
                  setUserCoords(detected);
                }}
                recentSearches={recentSearches}
              />
            </div>
          </div>
        </section>

        <LandingSections />
        <LotDirectory userCoords={userCoords} onUserCoordsChange={setUserCoords} />
      </main>

      <Footer />
    </div>
  );
}
