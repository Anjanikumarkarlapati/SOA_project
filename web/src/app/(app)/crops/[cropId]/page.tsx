import CropDetail from '@/components/pages/CropDetail'

export default async function CropDetailPage({ params }: { params: Promise<{ cropId: string }> }) {
  const { cropId } = await params
  return <CropDetail cropId={cropId} />
}
