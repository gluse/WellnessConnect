import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Users, MapPin, Star, Shield, Clock } from "lucide-react";

export default function Landing() {
  const { t } = useTranslation();
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="max-w-md mx-auto bg-white shadow-xl min-h-screen">
        {/* Header */}
        <div className="px-6 py-8 text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-800 mb-2">FitsMyTime</h1>
          <p className="text-neutral-600">{t('landing.heroSubtitle')}</p>
        </div>

        {/* Features */}
        <div className="px-6 space-y-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Local Services</CardTitle>
                  <CardDescription>Find services near you</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Dual Role</CardTitle>
                  <CardDescription>Seek services or provide them</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                  <Star className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-lg">Verified Providers</CardTitle>
                  <CardDescription>Trusted and rated services</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Secure Payments</CardTitle>
                  <CardDescription>Safe and protected transactions</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Categories Preview */}
        <div className="px-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Service Categories</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-primary/5 rounded-lg p-4 text-center">
              <Heart className="w-6 h-6 text-primary mx-auto mb-2" />
              <span className="text-sm font-medium">Health & Wellness</span>
            </div>
            <div className="bg-secondary/5 rounded-lg p-4 text-center">
              <Users className="w-6 h-6 text-secondary mx-auto mb-2" />
              <span className="text-sm font-medium">Education</span>
            </div>
            <div className="bg-accent/5 rounded-lg p-4 text-center">
              <Clock className="w-6 h-6 text-accent mx-auto mb-2" />
              <span className="text-sm font-medium">Entertainment</span>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="px-6 pb-8">
          <Button asChild variant="outline" className="w-full mb-3 py-6 text-lg rounded-xl" data-testid="button-browse-services">
            <Link href="/search">{t("guestSearch.browse")}</Link>
          </Button>
          <Button 
            onClick={handleLogin} 
            className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-lg font-semibold rounded-xl"
            data-testid="button-get-started"
          >
            {t('nav.getStarted')}
          </Button>
          <p className="text-center text-sm text-neutral-500 mt-4">
            {t("guestSearch.landingNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
